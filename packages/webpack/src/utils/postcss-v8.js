import fs from 'fs'
import path from 'path'
import consola from 'consola'
import { defaults, merge, cloneDeep } from 'lodash'
import createResolver from 'postcss-import-resolver'

import { isPureObject } from '@nuxt/utils'

export const orderPresets = {
  cssnanoLast (names) {
    const nanoIndex = names.indexOf('cssnano')
    if (nanoIndex !== names.length - 1) {
      names.push(names.splice(nanoIndex, 1)[0])
    }
    return names
  },
  presetEnvLast (names) {
    const nanoIndex = names.indexOf('postcss-preset-env')
    if (nanoIndex !== names.length - 1) {
      names.push(names.splice(nanoIndex, 1)[0])
    }
    return names
  },
  presetEnvAndCssnanoLast (names) {
    return orderPresets.cssnanoLast(orderPresets.presetEnvLast(names))
  }
}

function postcssConfigFileWarning () {
  if (postcssConfigFileWarning.executed) {
    return
  }
  consola.warn('Please use `build.postcss` in your nuxt.config.js instead of an external config file. Support for such files will be removed in Nuxt 3 as they remove all defaults set by Nuxt and can cause severe problems with features like alias resolving inside your CSS.')
  postcssConfigFileWarning.executed = true
}

export default class PostcssConfig {
  constructor (buildContext) {
    this.buildContext = buildContext
  }

  get cssSourceMap () {
    return this.buildContext.buildOptions.cssSourceMap
  }

  get postcssOptions () {
    return this.buildContext.buildOptions.postcss
  }

  get postcssImportAlias () {
    const alias = { ...this.buildContext.options.alias }

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

  get defaultPostcssOptions () {
    const { dev, srcDir, rootDir, modulesDir } = this.buildContext.options
    return {
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

        // https://github.com/csstools/postcss-preset-env
        // TODO: enable when https://github.com/csstools/postcss-preset-env/issues/191 gets closed
        // 'postcss-preset-env': this.preset || {},
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
      order: 'presetEnvAndCssnanoLast'
    }
  }

  searchConfigFile () {
    // Search for postCSS config file and use it if exists
    // https://github.com/michael-ciniawsky/postcss-load-config
    // TODO: Remove in Nuxt 3
    const { srcDir, rootDir } = this.buildContext.options
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

  configFromFile () {
    const loaderConfig = (this.postcssOptions && this.postcssOptions.config) || {}
    loaderConfig.path = loaderConfig.path || this.searchConfigFile()

    if (loaderConfig.path) {
      return {
        config: loaderConfig
      }
    }
  }

  normalize (postcssOptions) {
    // TODO: Remove in Nuxt 3
    if (Array.isArray(postcssOptions)) {
      consola.warn('Using an Array as `build.postcss` will be deprecated in Nuxt 3. Please switch to the object' +
        ' declaration')
      postcssOptions = { plugins: postcssOptions }
    }
    return postcssOptions
  }

  sortPlugins ({ plugins, order }) {
    const names = Object.keys(plugins)
    if (typeof order === 'string') {
      order = orderPresets[order]
    }
    return typeof order === 'function' ? order(names, orderPresets) : (order || names)
  }

  loadPlugins (postcssOptions) {
    const { plugins } = postcssOptions
    if (isPureObject(plugins)) {
      // Map postcss plugins into instances on object mode once
      postcssOptions.plugins = this.sortPlugins(postcssOptions)
        .map((p) => {
          const plugin = this.buildContext.nuxt.resolver.requireModule(p, { paths: [__dirname] })
          const opts = plugins[p]
          if (opts === false) {
            return false // Disabled
          }
          return plugin(opts)
        })
        .filter(Boolean)
    }
  }

  mergeWithDefaultOptions (postcssOptions) {
    if (isPureObject(postcssOptions)) {
      if (postcssOptions.preset) {
        this.preset = postcssOptions.preset
        delete postcssOptions.preset
      }
      if (Array.isArray(postcssOptions.plugins)) {
        defaults(postcssOptions, this.defaultPostcssOptions)
      } else if (typeof postcssOptions.postcssOptions === 'function') {
        const postCssOptionsFunction = postcssOptions.postcssOptions
        postcssOptions = (loaderContext) => {
          const result = this.mergeWithDefaultOptions(postCssOptionsFunction(loaderContext))
          if (result) {
            return result.postcssOptions
          }
        }
      } else {
        // Keep the order of default plugins
        postcssOptions = merge({}, this.defaultPostcssOptions, postcssOptions.postcssOptions || postcssOptions)
        this.loadPlugins(postcssOptions)
      }

      const { execute } = postcssOptions
      delete postcssOptions.execute
      delete postcssOptions.order

      return {
        execute,
        postcssOptions,
        sourceMap: this.cssSourceMap
      }
    }
  }

  config () {
    /* istanbul ignore if */
    if (!this.postcssOptions) {
      return false
    }

    let postcssOptions = this.configFromFile()
    if (postcssOptions) {
      return {
        postcssOptions,
        sourceMap: this.cssSourceMap
      }
    }

    postcssOptions = this.normalize(cloneDeep(this.postcssOptions))

    // Apply default plugins
    return this.mergeWithDefaultOptions(postcssOptions)
  }
}
