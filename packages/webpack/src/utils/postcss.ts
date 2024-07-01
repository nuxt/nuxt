import { fileURLToPath } from 'node:url'
import createResolver from 'postcss-import-resolver'
import type { Nuxt } from '@nuxt/schema'
import { defu } from 'defu'

const isPureObject = (obj: unknown): obj is Object => obj !== null && !Array.isArray(obj) && typeof obj === 'object'

const ensureItemIsLast = (item: string) => (arr: string[]) => {
  const index = arr.indexOf(item)
  if (index !== -1) {
    arr.splice(index, 1)
    arr.push(item)
  }
  return arr
}

const orderPresets = {
  cssnanoLast: ensureItemIsLast('cssnano'),
  autoprefixerLast: ensureItemIsLast('autoprefixer'),
  autoprefixerAndCssnanoLast (names: string[]) {
    return orderPresets.cssnanoLast(orderPresets.autoprefixerLast(names))
  },
}

export const getPostcssConfig = async (nuxt: Nuxt) => {
  function sortPlugins ({ plugins, order }: any) {
    const names = Object.keys(plugins)
    if (typeof order === 'string') {
      order = orderPresets[order as keyof typeof orderPresets]
    }
    return typeof order === 'function' ? order(names, orderPresets) : (order || names)
  }

  if (!nuxt.options.webpack.postcss || !nuxt.options.postcss) {
    return false
  }

  const postcssOptions = defu({}, nuxt.options.postcss, {
    plugins: {
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
    },
    sourceMap: nuxt.options.webpack.cssSourceMap,
    // Array, String or Function
    order: 'autoprefixerAndCssnanoLast',
  })

  // Keep the order of default plugins
  if (!Array.isArray(postcssOptions.plugins) && isPureObject(postcssOptions.plugins)) {
    // Map postcss plugins into instances on object mode once
    postcssOptions.plugins = await Promise.all(
      sortPlugins(postcssOptions).map(async (pluginName: string) => {
        try {
          const { default: pluginFn } = await import(pluginName)
          const pluginOptions = postcssOptions.plugins[pluginName]
          if (typeof pluginFn === 'function') {
            return pluginFn(pluginOptions)
          }
        } catch (error) {
          console.error(`Failed to import plugin ${pluginName}:`, error)
        }
        return null
      })
    ).then(plugins => plugins.filter(Boolean) as any) // Await Promise.all and then filter out null values
  }

  return {
    sourceMap: nuxt.options.webpack.cssSourceMap,
    ...nuxt.options.webpack.postcss,
    postcssOptions,
  }
}
