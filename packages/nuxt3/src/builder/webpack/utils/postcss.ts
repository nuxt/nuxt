import fs from 'fs'
import path from 'path'
import consola from 'consola'
import defaults from 'lodash/defaults'
import merge from 'lodash/merge'
import cloneDeep from 'lodash/cloneDeep'
import createResolver from 'postcss-import-resolver'

import type { Nuxt } from '../../../core'
import type { NormalizedConfiguration } from '../../../config'
import { isPureObject } from '../../../utils'

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
  nuxt: Nuxt
  options: NormalizedConfiguration

  constructor (nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options
  }

  get postcssOptions () {
    return this.options.build.postcss
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

        // https://github.com/csstools/postcss-preset-env
        'postcss-preset-env': this.preset || {},
        cssnano: dev ? false : { preset: 'default' }
      },
      // Array, String or Function
      order: 'presetEnvAndCssnanoLast'
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

  configFromFile () {
    const loaderConfig = (this.postcssOptions && this.postcssOptions.config) || {}
    loaderConfig.path = loaderConfig.path || this.searchConfigFile()

    if (loaderConfig.path) {
      return {
        sourceMap: this.options.build.cssSourceMap,
        config: loaderConfig
      }
    }
  }

  normalize (config) {
    // TODO: Remove in Nuxt 3
    if (Array.isArray(config)) {
      consola.warn('Using an Array as `build.postcss` will be deprecated in Nuxt 3. Please switch to the object' +
        ' declaration')
      config = { plugins: config }
    }
    return config
  }

  sortPlugins ({ plugins, order }) {
    const names = Object.keys(plugins)
    if (typeof order === 'string') {
      order = orderPresets[order]
    }
    return typeof order === 'function' ? order(names, orderPresets) : (order || names)
  }

  loadPlugins (config) {
    const { plugins } = config
    if (isPureObject(plugins)) {
      // Map postcss plugins into instances on object mode once
      config.plugins = this.sortPlugins(config)
        .map((p) => {
          const plugin = this.nuxt.resolver.requireModule(p)
          const opts = plugins[p]
          if (opts === false) {
            return false // Disabled
          }
          return plugin(opts)
        })
        .filter(Boolean)
    }
  }

  config () {
    /* istanbul ignore if */
    if (!this.postcssOptions) {
      return false
    }

    let config = this.configFromFile()
    if (config) {
      return config
    }

    config = this.normalize(cloneDeep(this.postcssOptions))

    // Apply default plugins
    if (isPureObject(config)) {
      if (config.preset) {
        this.preset = config.preset
        delete config.preset
      }
      if (Array.isArray(config.plugins)) {
        defaults(config, this.defaultConfig)
      } else {
        // Keep the order of default plugins
        config = merge({}, this.defaultConfig, config)
        this.loadPlugins(config)
      }
      return config
    }
  }
}
