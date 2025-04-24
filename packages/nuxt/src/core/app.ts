import { promises as fsp, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'pathe'
import { defu } from 'defu'
import { findPath, normalizePlugin, normalizeTemplate, resolveFiles, resolvePath } from '@nuxt/kit'
import type { Nuxt, NuxtApp, NuxtPlugin, NuxtTemplate, ResolvedNuxtTemplate } from 'nuxt/schema'

import type { PluginMeta } from 'nuxt/app'

import { logger } from '../utils'
import * as defaultTemplates from './templates'
import { getNameFromPath, hasSuffix, uniqueBy } from './utils'
import { extractMetadata, orderMap } from './plugins/plugin-metadata'

export function createApp (nuxt: Nuxt, options: Partial<NuxtApp> = {}): NuxtApp {
  return defu(options, {
    dir: nuxt.options.srcDir,
    extensions: nuxt.options.extensions,
    plugins: [],
    components: [],
    templates: [],
  } as unknown as NuxtApp) as NuxtApp
}

const postTemplates = [
  defaultTemplates.clientPluginTemplate.filename,
  defaultTemplates.serverPluginTemplate.filename,
  defaultTemplates.pluginsDeclaration.filename,
]

export async function generateApp (nuxt: Nuxt, app: NuxtApp, options: { filter?: (template: ResolvedNuxtTemplate<any>) => boolean } = {}) {
  // Resolve app
  await resolveApp(nuxt, app)

  // User templates from options.build.templates
  app.templates = Object.values(defaultTemplates).concat(nuxt.options.build.templates) as NuxtTemplate[]

  // Extend templates with hook
  await nuxt.callHook('app:templates', app)

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
    const key = template.filename && postTemplates.includes(template.filename) ? 'post' : 'pre'
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
      logger.error(`Could not compile template \`${template.filename}\`.`)
      logger.error(e)
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
    const setupTime = Math.round((perf * 100)) / 100

    if ((nuxt.options.debug && nuxt.options.debug.templates) || setupTime > 500) {
      logger.info(`Compiled \`${template.filename}\` in ${setupTime}ms`)
    }

    if (template.modified && template.write) {
      dirs.add(dirname(fullPath))
      writes.push(() => writeFileSync(fullPath, contents, 'utf8'))
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

  if (changedTemplates.length) {
    await nuxt.callHook('app:templatesGenerated', app, changedTemplates, options)
  }
}

/** @internal */
async function compileTemplate<T> (template: NuxtTemplate<T>, ctx: { nuxt: Nuxt, app: NuxtApp, utils?: unknown }) {
  delete ctx.utils

  if (template.src) {
    try {
      return await fsp.readFile(template.src, 'utf-8')
    } catch (err) {
      logger.error(`[nuxt] Error reading template from \`${template.src}\``)
      throw err
    }
  }
  if (template.getContents) {
    return template.getContents({ ...ctx, options: template.options! })
  }

  throw new Error('[nuxt] Invalid template. Templates must have either `src` or `getContents`: ' + JSON.stringify(template))
}

export async function resolveApp (nuxt: Nuxt, app: NuxtApp) {
  // Resolve main (app.vue)
  app.mainComponent ||= await findPath(
    nuxt.options._layers.flatMap(layer => [
      join(layer.config.srcDir, 'App'),
      join(layer.config.srcDir, 'app'),
    ]),
  )
  app.mainComponent ||= resolve(nuxt.options.appDir, 'components/welcome.vue')

  // Resolve root component
  app.rootComponent ||= await findPath(['~/app.root', resolve(nuxt.options.appDir, 'components/nuxt-root.vue')])

  // Resolve error component
  app.errorComponent ||= (await findPath(
    nuxt.options._layers.map(layer => join(layer.config.srcDir, 'error')),
  )) ?? resolve(nuxt.options.appDir, 'components/nuxt-error-page.vue')

  // Resolve layouts/ from all config layers
  const layerConfigs = nuxt.options._layers.map(layer => layer.config)
  const reversedConfigs = layerConfigs.slice().reverse()
  app.layouts = {}
  for (const config of layerConfigs) {
    const layoutDir = (config.rootDir === nuxt.options.rootDir ? nuxt.options.dir : config.dir)?.layouts || 'layouts'
    const layoutFiles = await resolveFiles(config.srcDir, `${layoutDir}/**/*{${nuxt.options.extensions.join(',')}}`)
    for (const file of layoutFiles) {
      const name = getNameFromPath(file, resolve(config.srcDir, layoutDir))
      if (!name) {
        // Ignore files like `~/layouts/index.vue` which end up not having a name at all
        logger.warn(`No layout name could be resolved for \`~/${relative(nuxt.options.srcDir, file)}\`. Bear in mind that \`index\` is ignored for the purpose of creating a layout name.`)
        continue
      }
      app.layouts[name] ||= { name, file }
    }
  }

  // Resolve middleware/ from all config layers, layers first
  app.middleware = []
  for (const config of reversedConfigs) {
    const middlewareDir = (config.rootDir === nuxt.options.rootDir ? nuxt.options.dir : config.dir)?.middleware || 'middleware'
    const middlewareFiles = await resolveFiles(config.srcDir, [
      `${middlewareDir}/*{${nuxt.options.extensions.join(',')}}`,
      ...nuxt.options.future.compatibilityVersion === 4
        ? [`${middlewareDir}/*/index{${nuxt.options.extensions.join(',')}}`]
        : [],
    ])
    for (const file of middlewareFiles) {
      const name = getNameFromPath(file)
      if (!name) {
        // Ignore files like `~/middleware/index.vue` which end up not having a name at all
        logger.warn(`No middleware name could be resolved for \`~/${relative(nuxt.options.srcDir, file)}\`. Bear in mind that \`index\` is ignored for the purpose of creating a middleware name.`)
        continue
      }
      app.middleware.push({ name, path: file, global: hasSuffix(file, '.global') })
    }
  }

  // Resolve plugins, first extended layers and then base
  app.plugins = []
  for (const config of reversedConfigs) {
    const pluginDir = (config.rootDir === nuxt.options.rootDir ? nuxt.options.dir : config.dir)?.plugins || 'plugins'
    app.plugins.push(...[
      ...(config.plugins || []),
      ...config.srcDir
        ? await resolveFiles(config.srcDir, [
          `${pluginDir}/*{${nuxt.options.extensions.join(',')}}`,
          `${pluginDir}/*/index{${nuxt.options.extensions.join(',')}}`,
        ])
        : [],
    ].map(plugin => normalizePlugin(plugin as NuxtPlugin)))
  }

  // Add back plugins not specified in layers or user config
  for (const p of [...nuxt.options.plugins].reverse()) {
    const plugin = normalizePlugin(p)
    if (!app.plugins.some(p => p.src === plugin.src)) {
      app.plugins.unshift(plugin)
    }
  }

  // Normalize and de-duplicate plugins and middleware
  app.middleware = uniqueBy(await resolvePaths(nuxt, [...app.middleware].reverse(), 'path'), 'name').reverse()
  app.plugins = uniqueBy(await resolvePaths(nuxt, app.plugins, 'src'), 'src')

  // Resolve app.config
  app.configs = []
  for (const config of layerConfigs) {
    const appConfigPath = await findPath(resolve(config.srcDir, 'app.config'))
    if (appConfigPath) {
      app.configs.push(appConfigPath)
    }
  }

  // Extend app
  await nuxt.callHook('app:resolve', app)

  // Normalize and de-duplicate plugins and middleware
  app.middleware = uniqueBy(await resolvePaths(nuxt, app.middleware, 'path'), 'name')
  app.plugins = uniqueBy(await resolvePaths(nuxt, app.plugins, 'src'), 'src')
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

export async function annotatePlugins (nuxt: Nuxt, plugins: NuxtPlugin[]) {
  const _plugins: Array<NuxtPlugin & Omit<PluginMeta, 'enforce'>> = []
  for (const plugin of plugins) {
    try {
      const code = plugin.src in nuxt.vfs ? nuxt.vfs[plugin.src]! : await fsp.readFile(plugin.src!, 'utf-8')
      _plugins.push({
        ...await extractMetadata(code, IS_TSX.test(plugin.src) ? 'tsx' : 'ts'),
        ...plugin,
      })
    } catch (e) {
      const relativePluginSrc = relative(nuxt.options.rootDir, plugin.src)
      if ((e as Error).message === 'Invalid plugin metadata') {
        logger.warn(`Failed to parse static properties from plugin \`${relativePluginSrc}\`, falling back to non-optimized runtime meta. Learn more: https://nuxt.com/docs/guide/directory-structure/plugins#object-syntax-plugins`)
      } else {
        logger.warn(`Failed to parse static properties from plugin \`${relativePluginSrc}\`.`, e)
      }
      _plugins.push(plugin)
    }
  }

  return _plugins.sort((a, b) => (a.order ?? orderMap.default) - (b.order ?? orderMap.default))
}

export function checkForCircularDependencies (_plugins: Array<NuxtPlugin & Omit<PluginMeta, 'enforce'>>) {
  const deps: Record<string, string[]> = Object.create(null)
  const pluginNames = _plugins.map(plugin => plugin.name)
  for (const plugin of _plugins) {
    // Make sure dependency plugins are registered
    if (plugin.dependsOn && plugin.dependsOn.some(name => !pluginNames.includes(name))) {
      console.error(`Plugin \`${plugin.name}\` depends on \`${plugin.dependsOn.filter(name => !pluginNames.includes(name)).join(', ')}\` but they are not registered.`)
    }
    // Make graph to detect circular dependencies
    if (plugin.name) {
      deps[plugin.name] = plugin.dependsOn || []
    }
  }
  const checkDeps = (name: string, visited: string[] = []): string[] => {
    if (visited.includes(name)) {
      console.error(`Circular dependency detected in plugins: ${visited.join(' -> ')} -> ${name}`)
      return []
    }
    visited.push(name)
    return deps[name]?.length ? deps[name].flatMap(dep => checkDeps(dep, [...visited])) : []
  }
  for (const name in deps) {
    checkDeps(name)
  }
}
