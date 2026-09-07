import { promises as fsp, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { dirname, join, resolve } from 'pathe'
import { defu } from 'defu'
import { Diagnostic } from 'nostics'
import { findPath, getLayerDirectories, normalizePlugin, normalizeTemplate, resolveFiles, resolvePath } from '@nuxt/kit'
import { buildDiagnostics, pageDiagnostics, pluginDiagnostics } from '@nuxt/kit/internal'

import { linkToAlias, logger } from '../utils.ts'
import * as defaultTemplates from './templates.ts'
import { getNameFromPath, hasSuffix, uniqueBy } from './utils/index.ts'
import type { ExtractedPluginMeta, PluginBuildMode } from './plugins/plugin-metadata.ts'
import { extractMetadata, orderMap } from './plugins/plugin-metadata.ts'
import type { Nuxt, NuxtApp, NuxtPlugin, NuxtTemplate, ResolvedNuxtTemplate } from 'nuxt/schema'

export function createApp (nuxt: Nuxt, options: Partial<NuxtApp> = {}): NuxtApp {
  return defu(options, {
    dir: nuxt.options.srcDir,
    extensions: nuxt.options.extensions,
    plugins: [],
    components: [],
    templates: [],
  } as unknown as NuxtApp) as NuxtApp
}

const structureVersions = new WeakMap<Nuxt, number>()
const resolvedStructureVersions = new WeakMap<NuxtApp, number>()

/**
 * Version of the app's file structure, bumped whenever a file is added to or removed
 * from a watched directory. Scans whose result depends only on which files exist
 * (layouts, middleware, plugins, components) can be reused while it is unchanged.
 *
 * While it is unchanged, `app:resolve` and `components:extend` are not re-run in dev.
 * Modules whose contributions depend on state other than the file tree should call
 * `updateTemplates()` with no filter to force a full re-resolution.
 */
export function getAppStructureVersion (nuxt: Nuxt): number {
  return structureVersions.get(nuxt) ?? 0
}

export function invalidateAppStructure (nuxt: Nuxt): void {
  structureVersions.set(nuxt, getAppStructureVersion(nuxt) + 1)
}

const postTemplates = new Set([
  defaultTemplates.clientPluginTemplate.filename,
  defaultTemplates.serverPluginTemplate.filename,
  defaultTemplates.pluginsDeclaration.filename,
])

export async function generateApp (nuxt: Nuxt, app: NuxtApp, options: { filter?: (template: ResolvedNuxtTemplate<any>) => boolean } = {}) {
  const generateStart = performance.now()
  // Resolve app
  await resolveApp(nuxt, app)
  const resolvedAt = performance.now()

  // User templates from options.build.templates
  app.templates = Object.values(defaultTemplates).concat(nuxt.options.build.templates) as NuxtTemplate[]

  // Extend templates with hook
  await nuxt.callHook('app:templates', app)
  const scannedAt = performance.now()

  // Normalize templates
  app.templates = app.templates.map(tmpl => normalizeTemplate(tmpl, nuxt.options.buildDir))

  // compile plugins first as they are needed within the nuxt.vfs
  // in order to annotate templated plugins
  const filteredTemplates: Record<'pre' | 'post', Array<ResolvedNuxtTemplate<any>>> = {
    pre: [],
    post: [],
  }

  for (const template of app.templates as Array<ResolvedNuxtTemplate<any>>) {
    if (options.filter && !options.filter(template)) { continue }
    const key = template.filename && postTemplates.has(template.filename) ? 'post' : 'pre'
    filteredTemplates[key].push(template)
  }

  // Compile templates into vfs
  const templateContext = { nuxt, app }

  const writes: Array<() => void> = []
  const dirs = new Set<string>()
  const changedTemplates: Array<ResolvedNuxtTemplate<any>> = []
  const FORWARD_SLASH_RE = /\//g
  async function processTemplate (template: ResolvedNuxtTemplate) {
    const fullPath = template.dst || resolve(nuxt.options.buildDir, template.filename!)
    const start = performance.now()
    const oldContents = nuxt.vfs[fullPath]
    const contents = await compileTemplate(template, templateContext).catch((e) => {
      // already-coded template failures (e.g. B1002/B1003) were reported in `compileTemplate`
      if (!(e instanceof Diagnostic)) {
        buildDiagnostics.NUXT_B1001({ filename: template.filename!, src: template.src, cause: e })
      }
      throw e
    })

    template.modified = oldContents !== contents
    if (template.modified) {
      nuxt.vfs[fullPath] = contents

      const aliasPath = '#build/' + template.filename
      nuxt.vfs[aliasPath] = contents

      // In case a non-normalized absolute path is called for on Windows
      if (process.platform === 'win32') {
        nuxt.vfs[fullPath.replace(FORWARD_SLASH_RE, '\\')] = contents
      }

      changedTemplates.push(template)
    }

    const perf = performance.now() - start
    const compileTime = Math.round((perf * 100)) / 100

    if ((nuxt.options.debug && nuxt.options.debug.templates) || compileTime > 500) {
      logger.info(`Compiled \`${linkToAlias(fullPath, nuxt)}\` in ${compileTime}ms`)
    }

    if (template.modified && template.write && !matchesDisk(fullPath, contents)) {
      dirs.add(dirname(fullPath))
      writes.push(() => writeFileSync(fullPath, contents, 'utf8'))
      if (nuxt.options.debug && nuxt.options.debug.templates) {
        logger.info(`Writing \`${template.filename}\` to \`${linkToAlias(fullPath, nuxt)}\``)
      }
    }
  }

  await Promise.allSettled(filteredTemplates.pre.map(processTemplate))
  await Promise.allSettled(filteredTemplates.post.map(processTemplate))

  // Write template files in single synchronous step to avoid (possible) additional
  // runtime overhead of cascading HMRs from vite/webpack
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true })
  }
  for (const write of writes) {
    write()
  }

  if (nuxt.options.debug && nuxt.options.debug.templates) {
    logger.info(`Generated app in ${Math.round(performance.now() - generateStart)}ms (resolve ${Math.round(resolvedAt - generateStart)}ms, scan ${Math.round(scannedAt - resolvedAt)}ms, compile ${Math.round(performance.now() - scannedAt)}ms), ${changedTemplates.length} template(s) changed`)
  }

  if (changedTemplates.length) {
    await nuxt.callHook('app:templatesGenerated', app, changedTemplates, options)
  }
}

/**
 * On a fresh start the in-memory comparison always reports a template as
 * modified, so check the file we are about to overwrite: an unchanged
 * `buildDir` keeps its mtimes stable for anything downstream that caches
 * against them.
 */
function matchesDisk (path: string, contents: string) {
  try {
    return readFileSync(path, 'utf8') === contents
  } catch {
    return false
  }
}

/** @internal */
async function compileTemplate<T> (template: NuxtTemplate<T>, ctx: { nuxt: Nuxt, app: NuxtApp, utils?: unknown }) {
  delete ctx.utils

  if (template.src) {
    try {
      return await fsp.readFile(template.src, 'utf-8')
    } catch (err) {
      throw buildDiagnostics.NUXT_B1002({ src: template.src, cause: err })
    }
  }
  if (template.getContents) {
    return template.getContents({ ...ctx, options: template.options! })
  }

  throw buildDiagnostics.NUXT_B1003()
}

export async function resolveApp (nuxt: Nuxt, app: NuxtApp) {
  // In dev, re-globbing every layer on each save is pure overhead unless a file has
  // been added or removed since the last resolution.
  const version = getAppStructureVersion(nuxt)
  if (nuxt.options.dev && resolvedStructureVersions.get(app) === version) { return }

  // resolve layer
  const layerDirs = getLayerDirectories(nuxt)
  const reversedLayerDirs = layerDirs.toReversed()

  // Resolve main (app.vue)
  app.mainComponent ||= await findPath(layerDirs.flatMap(d => [join(d.app, 'App'), join(d.app, 'app')]))
  app.mainComponent ||= resolve(nuxt.options.appDir, 'components/welcome.vue')

  // Resolve root component
  app.rootComponent ||= await findPath(['~/app.root', resolve(nuxt.options.appDir, 'components/nuxt-root.vue')])

  // Resolve error component
  app.errorComponent ||= await findPath(layerDirs.map(d => join(d.app, 'error'))) ?? resolve(nuxt.options.appDir, 'components/nuxt-error-page.vue')

  const extensionGlob = nuxt.options.extensions.join(',')

  // Resolve layouts/ from all config layers
  const layouts: NuxtApp['layouts'] = {}
  for (const dirs of layerDirs) {
    const layoutFiles = await resolveFiles(dirs.appLayouts, `**/*{${extensionGlob}}`)
    for (const file of layoutFiles) {
      const name = getNameFromPath(file, dirs.appLayouts)
      if (!name) {
        // Ignore files like `~/layouts/index.vue` which end up not having a name at all
        pageDiagnostics.NUXT_B4009({ file: linkToAlias(file, nuxt) })
        continue
      }
      layouts[name] ||= { name, file }
    }
  }

  // Resolve middleware/ from all config layers, layers first
  let middleware: NuxtApp['middleware'] = []
  for (const dirs of reversedLayerDirs) {
    const middlewareFiles = await resolveFiles(dirs.appMiddleware, [
      `*{${extensionGlob}}`,
      `*/index{${extensionGlob}}`,
    ])
    for (const file of middlewareFiles) {
      const name = getNameFromPath(file, dirs.appMiddleware)
      if (!name) {
        // Ignore files like `~/middleware/index.vue` which end up not having a name at all
        pageDiagnostics.NUXT_B4010({ file: linkToAlias(file, nuxt) })
        continue
      }
      middleware.push({ name, path: file, global: hasSuffix(file, '.global') })
    }
  }

  const reversedLayers = nuxt.options._layers.slice().reverse()
  // Resolve plugins, first extended layers and then base
  let plugins: NuxtApp['plugins'] = []
  for (let i = 0; i < reversedLayerDirs.length; i++) {
    const config = reversedLayers[i]!.config
    const dirs = reversedLayerDirs[i]!
    plugins.push(...[
      ...(config.plugins || []),
      ...await resolveFiles(dirs.appPlugins, [
        `*{${extensionGlob}}`,
        `*/index{${extensionGlob}}`,
      ]),
    ].map(plugin => normalizePlugin(plugin as NuxtPlugin)))
  }

  // Add back plugins not specified in layers or user config
  for (const p of nuxt.options.plugins.toReversed()) {
    const plugin = normalizePlugin(p)
    if (!plugins.some(p => p.src === plugin.src)) {
      plugins.unshift(plugin)
    }
  }

  // Normalize and de-duplicate plugins and middleware
  middleware = uniqueBy(await resolvePaths(nuxt, middleware.toReversed(), 'path'), 'name').reverse()
  plugins = uniqueBy(await resolvePaths(nuxt, plugins, 'src'), 'src')

  // Resolve app.config
  const configs: NuxtApp['configs'] = []
  for (const dirs of layerDirs) {
    const appConfigPath = await findPath(join(dirs.app, 'app.config'))
    if (appConfigPath) {
      configs.push(appConfigPath)
    }
  }

  Object.assign(app, { middleware, plugins, configs, layouts })

  // Extend app
  await nuxt.callHook('app:resolve', app)

  // Normalize and de-duplicate plugins, middleware and app configs
  app.middleware = uniqueBy(await resolvePaths(nuxt, app.middleware, 'path'), 'name')
  app.plugins = uniqueBy(await resolvePaths(nuxt, app.plugins, 'src'), 'src')
  app.configs = [...new Set(app.configs)]

  // committed only once resolution has fully succeeded, so a throwing `app:resolve`
  // hook doesn't leave a partially resolved app cached for subsequent rebuilds
  resolvedStructureVersions.set(app, version)
}

function resolvePaths<Item extends Record<string, any>> (nuxt: Nuxt, items: Item[], key: { [K in keyof Item]: Item[K] extends string ? K : never }[keyof Item]) {
  return Promise.all(items.map(async (item) => {
    if (!item[key]) { return item }
    return {
      ...item,
      [key]: await resolvePath(item[key], {
        alias: nuxt.options.alias,
        extensions: nuxt.options.extensions,
        fallbackToOriginal: true,
        virtual: true,
      }),
    }
  }))
}

const IS_TSX = /\.[jt]sx$/

export type AnnotatedPlugin = NuxtPlugin & ExtractedPluginMeta

export async function annotatePlugins (nuxt: Nuxt, plugins: NuxtPlugin[]): Promise<AnnotatedPlugin[]> {
  const _plugins: AnnotatedPlugin[] = []
  for (const plugin of plugins) {
    try {
      const code = nuxt.vfs[plugin.src] ?? await fsp.readFile(plugin.src!, 'utf-8')
      _plugins.push({
        ...await extractMetadata(code, IS_TSX.test(plugin.src) ? 'tsx' : 'ts'),
        ...plugin,
      })
    } catch (e) {
      const relativePluginSrc = linkToAlias(plugin.src, nuxt)
      const code = e instanceof Error ? e.name : ''
      if (code === 'NUXT_B2001' || code === 'NUXT_B2002') {
        pluginDiagnostics.NUXT_B2010({ src: relativePluginSrc })
      } else {
        pluginDiagnostics.NUXT_B2010({ src: relativePluginSrc, cause: e })
      }
      _plugins.push({ ...plugin, _metaUnknown: true })
    }
  }

  return _plugins.sort((a, b) => (a.order ?? orderMap.default) - (b.order ?? orderMap.default))
}

/**
 * Reorder `order`-sorted plugins so each plugin's `dependsOn` entries appear earlier in the array.
 * The original (order-sorted) sequence is preserved as the stable tiebreaker. Unknown dependency
 * names are ignored to match the runtime resolver. Cycles are not resolved here; any plugin still
 * pending after the walk is emitted in its original position. `checkForCircularDependencies`
 * surfaces those graphs separately.
 */
export function sortPluginsByDependsOn<T extends AnnotatedPlugin> (plugins: T[]): T[] {
  const known = new Set<string>()
  for (const plugin of plugins) {
    if (plugin.name) { known.add(plugin.name) }
  }

  const emitted = new Set<string>()
  const result: T[] = []
  const pending: T[] = []

  const tryEmit = (plugin: T): boolean => {
    const deps = plugin.dependsOn
    if (deps) {
      for (const dep of deps) {
        if (known.has(dep) && !emitted.has(dep)) { return false }
      }
    }
    result.push(plugin)
    if (plugin.name) { emitted.add(plugin.name) }
    return true
  }

  const flushPending = () => {
    let progressed = true
    while (progressed) {
      progressed = false
      for (let i = 0; i < pending.length;) {
        if (tryEmit(pending[i]!)) {
          pending.splice(i, 1)
          progressed = true
        } else {
          i++
        }
      }
    }
  }

  for (const plugin of plugins) {
    if (!tryEmit(plugin)) {
      pending.push(plugin)
    } else {
      flushPending()
    }
  }

  // Any leftover entries are part of a cycle (or transitively depend on one).
  // Preserve their original relative order.
  for (const plugin of pending) {
    result.push(plugin)
  }

  return result
}

export function filterPluginDependencies<T extends AnnotatedPlugin> (plugins: T[], options: { warn?: boolean, mode?: PluginBuildMode, allPlugins?: AnnotatedPlugin[] } = {}): T[] {
  // A plugin with dynamic metadata may provide a name we cannot see at build time.
  // In that case keep the complete graph so the runtime resolver can handle it
  // conservatively, but still emit the dev-time warnings: cross-environment
  // dependencies are never bundled for this build regardless of what the dynamic
  // plugin provides.
  const filter = !plugins.some(plugin => plugin._metaUnknown)

  const pluginNames = new Set(plugins.map(plugin => plugin.name))
  const allPluginNames = new Set((options.allPlugins || plugins).map(plugin => plugin.name))
  const result = plugins.map((plugin) => {
    if (!plugin.dependsOn?.some(name => !pluginNames.has(name))) {
      return plugin
    }

    const missing = plugin.dependsOn.filter(name => !pluginNames.has(name))
    if (options.warn) {
      const unavailable = options.mode ? missing.filter(name => allPluginNames.has(name)) : []
      const unregistered = options.mode ? missing.filter(name => !allPluginNames.has(name)) : missing
      if (unavailable.length && options.mode) {
        pluginDiagnostics.NUXT_B2012({ name: plugin.name!, dependencies: unavailable, mode: options.mode })
      }
      if (unregistered.length) {
        pluginDiagnostics.NUXT_B2008({ name: plugin.name!, missing: unregistered.join(', ') })
      }
    }

    if (!filter) {
      return plugin
    }

    return {
      ...plugin,
      dependsOn: plugin.dependsOn.filter(name => pluginNames.has(name)),
    }
  })

  return filter ? result : plugins
}

export function hasPluginDependencies (plugins: Array<{ dependsOn?: string[], _metaUnknown?: boolean }>): boolean {
  for (const plugin of plugins) {
    if (plugin._metaUnknown) { return true }
    if (plugin.dependsOn && plugin.dependsOn.length > 0) { return true }
  }
  return false
}

export function hasParallelPlugins (plugins: Array<{ parallel?: boolean, _metaUnknown?: boolean }>): boolean {
  for (const plugin of plugins) {
    if (plugin._metaUnknown) { return true }
    if (plugin.parallel) { return true }
  }
  return false
}

export function hasPluginHooks (plugins: Array<{ hasHooks?: boolean, _metaUnknown?: boolean }>): boolean {
  for (const plugin of plugins) {
    if (plugin._metaUnknown) { return true }
    if (plugin.hasHooks) { return true }
  }
  return false
}

export function hasIslandOptOutPlugins (plugins: Array<{ hasEnv?: boolean, _metaUnknown?: boolean }>): boolean {
  for (const plugin of plugins) {
    if (plugin._metaUnknown) { return true }
    if (plugin.hasEnv) { return true }
  }
  return false
}

export function checkForCircularDependencies (_plugins: AnnotatedPlugin[]) {
  const deps: Record<string, string[]> = Object.create(null)
  for (const plugin of _plugins) {
    // Make graph to detect circular dependencies
    if (plugin.name) {
      deps[plugin.name] = plugin.dependsOn || []
    }
  }
  const checkDeps = (name: string, visited: string[] = []): string[] => {
    if (visited.includes(name)) {
      pluginDiagnostics.NUXT_B2009({ cycle: `${visited.join(' -> ')} -> ${name}` })
      return []
    }
    visited.push(name)
    return deps[name]?.length ? deps[name].flatMap(dep => checkDeps(dep, [...visited])) : []
  }
  for (const name in deps) {
    checkDeps(name)
  }
}
