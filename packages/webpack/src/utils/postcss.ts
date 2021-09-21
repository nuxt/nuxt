import fs from 'fs'
import path from 'upath'
import consola from 'consola'
import { defaults, merge, cloneDeep } from 'lodash'
import createResolver from 'postcss-import-resolver'
import { Nuxt, requireModule } from '@nuxt/kit'

const isPureObject = obj => obj !== null && !Array.isArray(obj) && typeof obj === 'object'

export const orderPresets = {
  cssnanoLast (names) {
    const nanoIndex = names.indexOf('cssnano')
    if (nanoIndex !== names.length - 1) {
      names.push(names.splice(nanoIndex, 1)[0])
    }
    return names
  },
  autoprefixerLast (names) {
    const nanoIndex = names.indexOf('autoprefixer')
    if (nanoIndex !== names.length - 1) {
      names.push(names.splice(nanoIndex, 1)[0])
    }
    return names
  },
  autoprefixerAndCssnanoLast (names) {
    return orderPresets.cssnanoLast(orderPresets.autoprefixerLast(names))
  }
}

let _postcssConfigFileWarningShown
function postcssConfigFileWarning () {
  if (_postcssConfigFileWarningShown) {
    return
  }
  consola.warn('Please use `build.postcss` in your nuxt.config.js instead of an external config file. Support for such files will be removed in Nuxt 3 as they remove all defaults set by Nuxt and can cause severe problems with features like alias resolving inside your CSS.')
  _postcssConfigFileWarningShown = true
}

export class PostcssConfig {
  nuxt: Nuxt
  options: Nuxt['options']

  constructor (nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options
  }

  get postcssOptions () {
    return this.options.build.postcss.postcssOptions
  }

  get postcssImportAlias () {
    const alias = { ...this.options.alias }

    for (const key in alias) {
      if (key.startsWith('~')) {
        continue
      }
      const newKey = '~' + key
      if (!alias[newKey]) {
        alias[newKey] = alias[key]
      }
    }

    return alias
  }

  get defaultConfig () {
    const { dev, srcDir, rootDir, modulesDir } = this.options
    return {
      sourceMap: this.options.build.cssSourceMap,
      plugins: {
        // https://github.com/postcss/postcss-import
        'postcss-import': {
          resolve: createResolver({
            alias: this.postcssImportAlias,
            modules: [srcDir, rootDir, ...modulesDir]
          })
        },

        // https://github.com/postcss/postcss-url
        'postcss-url': {},

        autoprefixer: {},

        cssnano: dev
          ? false
          : {
              preset: ['default', {
                // Keep quotes in font values to prevent from HEX conversion
                // https://github.com/nuxt/nuxt.js/issues/6306
                minifyFontValues: { removeQuotes: false }
              }]
            }
      },
      // Array, String or Function
      order: 'autoprefixerAndCssnanoLast'
    }
  }

  searchConfigFile () {
    // Search for postCSS config file and use it if exists
    // https://github.com/michael-ciniawsky/postcss-load-config
    // TODO: Remove in Nuxt 3
    const { srcDir, rootDir } = this.options
    for (const dir of [srcDir, rootDir]) {
      for (const file of [
        'postcss.config.js',
        '.postcssrc.js',
        '.postcssrc',
        '.postcssrc.json',
        '.postcssrc.yaml'
      ]) {
        const configFile = path.resolve(dir, file)
        if (fs.existsSync(configFile)) {
          postcssConfigFileWarning()
          return configFile
        }
      }
    }
  }

  getConfigFile () {
    const loaderConfig = (this.postcssOptions && this.postcssOptions.config) || {}
    const postcssConfigFile = loaderConfig || this.searchConfigFile()

    if (typeof postcssConfigFile === 'string') {
      return postcssConfigFile
    }
  }

  sortPlugins ({ plugins, order }) {
    const names = Object.keys(plugins)
    if (typeof order === 'string') {
      order = orderPresets[order]
    }
    return typeof order === 'function' ? order(names, orderPresets) : (order || names)
  }

  loadPlugins (config) {
    if (!isPureObject(config.plugins)) { return }
    // Map postcss plugins into instances on object mode once
    config.plugins = this.sortPlugins(config).map((pluginName) => {
      const pluginFn = requireModule(pluginName, { paths: [__dirname] })
      const pluginOptions = config.plugins[pluginName]
      if (!pluginOptions || typeof pluginFn !== 'function') { return null }
      return pluginFn(pluginOptions)
    }).filter(Boolean)
  }

  config () {
    /* istanbul ignore if */
    if (!this.options.build.postcss) {
      return false
    }

    const configFile = this.getConfigFile()
    if (configFile) {
      return {
        postcssOptions: {
          config: configFile
        },
        sourceMap: this.options.build.cssSourceMap
      }
    }

    let postcssOptions = cloneDeep(this.postcssOptions)

    // Apply default plugins
    if (isPureObject(postcssOptions)) {
      if (Array.isArray(postcssOptions.plugins)) {
        defaults(postcssOptions, this.defaultConfig)
      } else {
        // Keep the order of default plugins
        postcssOptions = merge({}, this.defaultConfig, postcssOptions)
        this.loadPlugins(postcssOptions)
      }

      delete this.options.build.postcss.order

      return {
        sourceMap: this.options.build.cssSourceMap,
        ...this.options.build.postcss,
        postcssOptions
      }
    }
  }
}
