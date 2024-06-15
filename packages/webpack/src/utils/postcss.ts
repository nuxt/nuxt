import { fileURLToPath } from 'node:url'
import createResolver from 'postcss-import-resolver'
import { requireModule } from '@nuxt/kit'
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

export const getPostcssConfig = (nuxt: Nuxt) => {
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
    const cwd = fileURLToPath(new URL('.', import.meta.url))
    postcssOptions.plugins = sortPlugins(postcssOptions).map((pluginName: string) => {
      // TODO: remove use of requireModule in favour of ESM import
      const pluginFn = requireModule(pluginName, { paths: [cwd] })
      const pluginOptions = postcssOptions.plugins[pluginName]
      if (!pluginOptions || typeof pluginFn !== 'function') { return null }
      return pluginFn(pluginOptions)
    }).filter(Boolean)
  }

  return {
    sourceMap: nuxt.options.webpack.cssSourceMap,
    ...nuxt.options.webpack.postcss,
    postcssOptions,
  }
}
