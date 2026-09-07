import createResolver from 'postcss-import-resolver'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import { defu } from 'defu'
import type { Plugin } from 'postcss'
import { directoryToURL, getAddDependencyCommand, tryImportModule } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'

const isPureObject = (obj: unknown): obj is object => obj !== null && !Array.isArray(obj) && typeof obj === 'object'

function sortPlugins ({ plugins, order }: NuxtOptions['postcss']): string[] {
  const names = Object.keys(plugins)
  return typeof order === 'function' ? order(names) : (order || names)
}

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
    for (const pluginName of sortPlugins(postcssOptions)) {
      const pluginOptions = postcssOptions.plugins[pluginName]
      if (!pluginOptions) { continue }

      const isDefault = defaultPluginNames.has(pluginName)
      const parentURLs = isDefault
        ? [new URL(import.meta.url)]
        : nuxt.options.modulesDir.map(dir => directoryToURL(dir.replace(/\/node_modules\/?$/, '')))

      const pluginFn = await tryImportModule<(opts: Record<string, any>) => Plugin>(pluginName, { url: parentURLs })
      if (typeof pluginFn === 'function') {
        plugins.push(pluginFn(pluginOptions))
      } else {
        const installCommand = await getAddDependencyCommand(pluginName, nuxt.options.rootDir, { dev: true })
        if (isDefault) {
          bundlerDiagnostics.NUXT_B7011({ pluginName, installCommand })
        } else {
          bundlerDiagnostics.NUXT_B7007({ pluginName, installCommand })
        }
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
