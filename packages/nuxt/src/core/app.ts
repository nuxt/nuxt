import { promises as fsp, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'pathe'
import { defu } from 'defu'
import { compileTemplate, findPath, logger, normalizePlugin, normalizeTemplate, resolveAlias, resolveFiles, resolvePath, templateUtils, tryResolveModule } from '@nuxt/kit'
import type { Nuxt, NuxtApp, NuxtPlugin, NuxtTemplate, ResolvedNuxtTemplate } from 'nuxt/schema'

import * as defaultTemplates from './templates'
import { getNameFromPath, hasSuffix, uniqueBy } from './utils'
import { extractMetadata, orderMap } from './plugins/plugin-metadata'

export function createApp (nuxt: Nuxt, options: Partial<NuxtApp> = {}): NuxtApp {
  return defu(options, {
    dir: nuxt.options.srcDir,
    extensions: nuxt.options.extensions,
    plugins: [],
    components: [],
    templates: []
  } as unknown as NuxtApp) as NuxtApp
}

export async function generateApp (nuxt: Nuxt, app: NuxtApp, options: { filter?: (template: ResolvedNuxtTemplate<any>) => boolean } = {}) {
  // Resolve app
  await resolveApp(nuxt, app)

  // User templates from options.build.templates
  app.templates = Object.values(defaultTemplates).concat(nuxt.options.build.templates) as NuxtTemplate[]

  // Extend templates with hook
  await nuxt.callHook('app:templates', app)

  // Normalize templates
  app.templates = app.templates.map(tmpl => normalizeTemplate(tmpl))

  // Compile templates into vfs
  // TODO: remove utils in v4
  const templateContext = { utils: templateUtils, nuxt, app }
  const filteredTemplates = (app.templates as Array<ReturnType<typeof normalizeTemplate>>)
    .filter(template => !options.filter || options.filter(template))

  const writes: Array<() => void> = []
  await Promise.allSettled(filteredTemplates
    .map(async (template) => {
      const fullPath = template.dst || resolve(nuxt.options.buildDir, template.filename!)
      const mark = performance.mark(fullPath)
      const contents = await compileTemplate(template, templateContext).catch((e) => {
        logger.error(`Could not compile template \`${template.filename}\`.`)
        throw e
      })

      nuxt.vfs[fullPath] = contents

      const aliasPath = '#build/' + template.filename!.replace(/\.\w+$/, '')
      nuxt.vfs[aliasPath] = contents

      // In case a non-normalized absolute path is called for on Windows
      if (process.platform === 'win32') {
        nuxt.vfs[fullPath.replace(/\//g, '\\')] = contents
      }

      const perf = performance.measure(fullPath, mark?.name) // TODO: remove when Node 14 reaches EOL
      const setupTime = perf ? Math.round((perf.duration * 100)) / 100 : 0 // TODO: remove when Node 14 reaches EOL

      if (nuxt.options.debug || setupTime > 500) {
        logger.info(`Compiled \`${template.filename}\` in ${setupTime}ms`)
      }

      if (template.write) {
        writes.push(() => {
          mkdirSync(dirname(fullPath), { recursive: true })
          writeFileSync(fullPath, contents, 'utf8')
        })
      }
    }))

  // Write template files in single synchronous step to avoid (possible) additional
  // runtime overhead of cascading HMRs from vite/webpack
  for (const write of writes) { write() }

  await nuxt.callHook('app:templatesGenerated', app, filteredTemplates, options)
}

async function resolveApp (nuxt: Nuxt, app: NuxtApp) {
  // Resolve main (app.vue)
  if (!app.mainComponent) {
    app.mainComponent = await findPath(
      nuxt.options._layers.flatMap(layer => [
        join(layer.config.srcDir, 'App'),
        join(layer.config.srcDir, 'app')
      ])
    )
  }
  if (!app.mainComponent) {
    app.mainComponent = (await tryResolveModule('@nuxt/ui-templates/templates/welcome.vue', nuxt.options.modulesDir)) ?? '@nuxt/ui-templates/templates/welcome.vue'
  }

  // Resolve root component
  if (!app.rootComponent) {
    app.rootComponent = await findPath(['~/app.root', resolve(nuxt.options.appDir, 'components/nuxt-root.vue')])
  }

  // Resolve error component
  if (!app.errorComponent) {
    app.errorComponent = (await findPath(
      nuxt.options._layers.map(layer => join(layer.config.srcDir, 'error'))
    )) ?? resolve(nuxt.options.appDir, 'components/nuxt-error-page.vue')
  }

  // Resolve layouts/ from all config layers
  app.layouts = {}
  for (const config of nuxt.options._layers.map(layer => layer.config)) {
    const layoutDir = (config.rootDir === nuxt.options.rootDir ? nuxt.options : config).dir?.layouts || 'layouts'
    const layoutFiles = await resolveFiles(config.srcDir, `${layoutDir}/*{${nuxt.options.extensions.join(',')}}`)
    for (const file of layoutFiles) {
      const name = getNameFromPath(file)
      app.layouts[name] = app.layouts[name] || { name, file }
    }
  }

  // Resolve middleware/ from all config layers, layers first
  app.middleware = []
  for (const config of nuxt.options._layers.map(layer => layer.config).reverse()) {
    const middlewareDir = (config.rootDir === nuxt.options.rootDir ? nuxt.options : config).dir?.middleware || 'middleware'
    const middlewareFiles = await resolveFiles(config.srcDir, `${middlewareDir}/*{${nuxt.options.extensions.join(',')}}`)
    app.middleware.push(...middlewareFiles.map((file) => {
      const name = getNameFromPath(file)
      return { name, path: file, global: hasSuffix(file, '.global') }
    }))
  }

  // Resolve plugins, first extended layers and then base
  app.plugins = []
  for (const config of nuxt.options._layers.map(layer => layer.config).reverse()) {
    const pluginDir = (config.rootDir === nuxt.options.rootDir ? nuxt.options : config).dir?.plugins || 'plugins'
    app.plugins.push(...[
      ...(config.plugins || []),
      ...config.srcDir
        ? await resolveFiles(config.srcDir, [
          `${pluginDir}/*.{ts,js,mjs,cjs,mts,cts}`,
          `${pluginDir}/*/index.*{ts,js,mjs,cjs,mts,cts}` // TODO: remove, only scan top-level plugins #18418
        ])
        : []
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
  app.middleware = uniqueBy(await resolvePaths(app.middleware, 'path'), 'name')
  app.plugins = uniqueBy(await resolvePaths(app.plugins, 'src'), 'src')

  // Resolve app.config
  app.configs = []
  for (const config of nuxt.options._layers.map(layer => layer.config)) {
    const appConfigPath = await findPath(resolve(config.srcDir, 'app.config'))
    if (appConfigPath) {
      app.configs.push(appConfigPath)
    }
  }

  // Extend app
  await nuxt.callHook('app:resolve', app)

  // Normalize and de-duplicate plugins and middleware
  app.middleware = uniqueBy(await resolvePaths(app.middleware, 'path'), 'name')
  app.plugins = uniqueBy(await resolvePaths(app.plugins, 'src'), 'src')
}

function resolvePaths<Item extends Record<string, any>> (items: Item[], key: { [K in keyof Item]: Item[K] extends string ? K : never }[keyof Item]) {
  return Promise.all(items.map(async (item) => {
    if (!item[key]) { return item }
    return {
      ...item,
      [key]: await resolvePath(resolveAlias(item[key]))
    }
  }))
}

export async function annotatePlugins (nuxt: Nuxt, plugins: NuxtPlugin[]) {
  const _plugins: NuxtPlugin[] = []
  for (const plugin of plugins) {
    try {
      const code = plugin.src in nuxt.vfs ? nuxt.vfs[plugin.src] : await fsp.readFile(plugin.src!, 'utf-8')
      _plugins.push({
        ...await extractMetadata(code),
        ...plugin
      })
    } catch (e) {
      logger.warn(`Could not resolve \`${plugin.src}\`.`)
      _plugins.push(plugin)
    }
  }

  return _plugins.sort((a, b) => (a.order ?? orderMap.default) - (b.order ?? orderMap.default))
}
