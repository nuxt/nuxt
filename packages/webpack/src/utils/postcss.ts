import createResolver from 'postcss-import-resolver'
import { createCommonJS } from 'mlly'
import { requireModule } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { defu } from 'defu'

const isPureObject = (obj: unknown): obj is Object => obj !== null && !Array.isArray(obj) && typeof obj === 'object'

const orderPresets = {
  cssnanoLast (names: string[]) {
    const nanoIndex = names.indexOf('cssnano')
    if (nanoIndex !== names.length - 1) {
      names.push(names.splice(nanoIndex, 1)[0])
    }
    return names
  },
  autoprefixerLast (names: string[]) {
    const nanoIndex = names.indexOf('autoprefixer')
    if (nanoIndex !== names.length - 1) {
      names.push(names.splice(nanoIndex, 1)[0])
    }
    return names
  },
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
    const cjs = createCommonJS(import.meta.url)
    const plugins = []
    for (const pluginName of sortPlugins(postcssOptions)) {
      const pluginFn = requireModule(pluginName, { paths: [cjs.__dirname] })
      const pluginOptions = postcssOptions.plugins[pluginName]
      if (!pluginOptions || typeof pluginFn !== 'function') { return null }
      const finalPlugin = pluginFn(pluginOptions)
      if (finalPlugin) {
        plugins.push(finalPlugin)
      }
    }
    postcssOptions.plugins = plugins
  }

  return {
    sourceMap: nuxt.options.webpack.cssSourceMap,
    ...nuxt.options.webpack.postcss,
    postcssOptions,
  }
}
