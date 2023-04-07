import { createCommonJS } from 'mlly'
import { cloneDeep, defaults, merge } from 'lodash-es'
import { requireModule } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

const isPureObject = (obj: unknown): obj is Object => obj !== null && !Array.isArray(obj) && typeof obj === 'object'

export const orderPresets = {
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
  }
}

export const getPostcssConfig = (nuxt: Nuxt) => {
  function defaultConfig () {
    return {
      sourceMap: nuxt.options.webpack.cssSourceMap,
      plugins: nuxt.options.postcss.plugins,
      // Array, String or Function
      order: 'autoprefixerAndCssnanoLast'
    }
  }

  function sortPlugins ({ plugins, order }: any) {
    const names = Object.keys(plugins)
    if (typeof order === 'string') {
      order = orderPresets[order as keyof typeof orderPresets]
    }
    return typeof order === 'function' ? order(names, orderPresets) : (order || names)
  }

  function loadPlugins (config: any) {
    if (!isPureObject(config.plugins)) { return }

    // Map postcss plugins into instances on object mode once
    const cjs = createCommonJS(import.meta.url)
    config.plugins = sortPlugins(config).map((pluginName: string) => {
      const pluginFn = requireModule(pluginName, { paths: [cjs.__dirname] })
      const pluginOptions = config.plugins[pluginName]
      if (!pluginOptions || typeof pluginFn !== 'function') { return null }
      return pluginFn(pluginOptions)
    }).filter(Boolean)
  }

  if (!nuxt.options.webpack.postcss || !nuxt.options.postcss) {
    return false
  }

  let postcssOptions = cloneDeep(nuxt.options.postcss)
  // Apply default plugins
  if (isPureObject(postcssOptions)) {
    if (Array.isArray(postcssOptions.plugins)) {
      defaults(postcssOptions, defaultConfig())
    } else {
      // Keep the order of default plugins
      postcssOptions = merge({}, defaultConfig(), postcssOptions)
      loadPlugins(postcssOptions)
    }

    // @ts-expect-error
    delete nuxt.options.webpack.postcss.order

    return {
      // @ts-expect-error
      sourceMap: nuxt.options.webpack.cssSourceMap,
      ...nuxt.options.webpack.postcss,
      postcssOptions
    }
  }
}
