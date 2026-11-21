import createResolver from 'postcss-import-resolver'
import type { Nuxt } from '@nuxt/schema'
import { defu } from 'defu'
import type { Plugin } from 'postcss'
import { getAddDependencyCommand, tryImportModule } from '@nuxt/kit'
import { bundlerDiagnostics, resolvePostcssPlugin, resolvePostcssPluginPath, sortPostcssPlugins } from '@nuxt/kit/internal'

type PluginFactory = (opts: Record<string, any>) => Plugin

const isPureObject = (obj: unknown): obj is object => obj !== null && !Array.isArray(obj) && typeof obj === 'object'

/** Every style rule loads the plugins, so each one is resolved, and offered for install, once per build. */
const pluginFactories = new WeakMap<Nuxt, Map<string, Promise<PluginFactory | undefined>>>()

export async function getPostcssConfig (nuxt: Nuxt) {
  if (!nuxt.options.webpack.postcss || !nuxt.options.postcss) {
    return false
  }

  const defaultPlugins = {
    'autoprefixer': {},

    'cssnano': nuxt.options.dev ? false : {},

    /**
     * https://github.com/postcss/postcss-import
     */
    'postcss-import': {
      resolve: createResolver({
        alias: { ...nuxt.options.alias },
        modules: nuxt.options.modulesDir,
      }),
    },

    /**
     * https://github.com/postcss/postcss-url
     */
    'postcss-url': {},
  }

  const postcssOptions = defu({}, nuxt.options.postcss, {
    config: false,
    plugins: defaultPlugins,
    sourceMap: nuxt.options.webpack.cssSourceMap,
  })

  const defaultPluginNames = new Set(Object.keys(defaultPlugins))

  // Keep the order of default plugins
  if (!Array.isArray(postcssOptions.plugins) && isPureObject(postcssOptions.plugins)) {
    // Map postcss plugins into instances on object mode once
    const plugins: Plugin[] = []
    for (const pluginName of sortPostcssPlugins(postcssOptions)) {
      const pluginOptions = postcssOptions.plugins[pluginName]
      if (!pluginOptions) { continue }

      const pluginFn = await loadPlugin(pluginName, nuxt, defaultPluginNames.has(pluginName))
      if (typeof pluginFn === 'function') {
        plugins.push(pluginFn(pluginOptions))
      }
    }

    // @ts-expect-error we are mutating type here from object to array
    postcssOptions.plugins = plugins
  }

  return {
    sourceMap: nuxt.options.webpack.cssSourceMap,
    ...nuxt.options.webpack.postcss,
    postcssOptions,
  }
}

function loadPlugin (pluginName: string, nuxt: Nuxt, isDefault: boolean): Promise<PluginFactory | undefined> {
  let factories = pluginFactories.get(nuxt)
  if (!factories) {
    factories = new Map()
    pluginFactories.set(nuxt, factories)
  }
  let factory = factories.get(pluginName)
  if (!factory) {
    factory = isDefault ? resolveDefaultPlugin(pluginName, nuxt) : resolvePostcssPlugin<Plugin>(pluginName, nuxt)
    factories.set(pluginName, factory)
  }
  return factory
}

async function resolveDefaultPlugin (pluginName: string, nuxt: Nuxt): Promise<PluginFactory | undefined> {
  const pluginPath = resolvePostcssPluginPath(pluginName, [new URL(import.meta.url)])
  const pluginFn = pluginPath ? await tryImportModule<PluginFactory>(pluginPath) : undefined
  if (typeof pluginFn === 'function') {
    return pluginFn
  }
  bundlerDiagnostics.NUXT_B7011({ pluginName, installCommand: await getAddDependencyCommand(pluginName, nuxt.options.rootDir, { dev: true }) })
}
