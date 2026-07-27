import createResolver from 'postcss-import-resolver'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import { defu } from 'defu'
import { createJiti } from 'jiti'
import type { Plugin } from 'postcss'
import { bundlerDiagnostics } from '@nuxt/kit'

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
    plugins: defaultPlugins,
    sourceMap: nuxt.options.webpack.cssSourceMap,
  })

  const defaultPluginNames = new Set(Object.keys(defaultPlugins))

  const jiti = createJiti(nuxt.options.rootDir, { alias: nuxt.options.alias })

  // Keep the order of default plugins
  if (!Array.isArray(postcssOptions.plugins) && isPureObject(postcssOptions.plugins)) {
    // Map postcss plugins into instances on object mode once
    const plugins: Plugin[] = []
    for (const pluginName of sortPlugins(postcssOptions)) {
      const pluginOptions = postcssOptions.plugins[pluginName]
      if (!pluginOptions) { continue }

      const isDefault = defaultPluginNames.has(pluginName)
      const parentURLs = isDefault ? [import.meta.url] : nuxt.options.modulesDir

      let pluginFn: ((opts: Record<string, any>) => Plugin) | undefined
      for (const parentURL of parentURLs) {
        pluginFn = await jiti.import(pluginName, { parentURL: parentURL.replace(/\/node_modules\/?$/, ''), try: true, default: true }) as (opts: Record<string, any>) => Plugin
        if (typeof pluginFn === 'function') {
          plugins.push(pluginFn(pluginOptions))
          break
        }
      }

      if (typeof pluginFn !== 'function') {
        if (isDefault) {
          bundlerDiagnostics.NUXT_B7011({ pluginName })
        } else {
          bundlerDiagnostics.NUXT_B7007({ pluginName })
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
