import fs from 'fs'
import path from 'path'

import _ from 'lodash'
import createResolver from 'postcss-import-resolver'

import { isPureObject } from '../../../common/utils'

export default class PostcssConfig {
  constructor(options, nuxt) {
    this.nuxt = nuxt
    this.dev = options.dev
    this.postcss = options.build.postcss
    this.srcDir = options.srcDir
    this.rootDir = options.rootDir
    this.cssSourceMap = options.build.cssSourceMap
    this.modulesDir = options.modulesDir
  }

  get defaultConfig() {
    return {
      useConfigFile: false,
      sourceMap: this.cssSourceMap,
      plugins: {
        // https://github.com/postcss/postcss-import
        'postcss-import': {
          resolve: createResolver({
            alias: {
              '~': path.join(this.srcDir),
              '~~': path.join(this.rootDir),
              '@': path.join(this.srcDir),
              '@@': path.join(this.rootDir)
            },
            modules: [
              this.srcDir,
              this.rootDir,
              ...this.modulesDir
            ]
          })
        },

        // https://github.com/postcss/postcss-url
        'postcss-url': {},

        // https://github.com/csstools/postcss-preset-env
        'postcss-preset-env': this.preset || {},
        'cssnano': this.dev ? false : { preset: 'default' }
      }
    }
  }

  configFromFile() {
    // Search for postCSS config file and use it if exists
    // https://github.com/michael-ciniawsky/postcss-load-config
    for (const dir of [this.srcDir, this.rootDir]) {
      for (const file of [
        'postcss.config.js',
        '.postcssrc.js',
        '.postcssrc',
        '.postcssrc.json',
        '.postcssrc.yaml'
      ]) {
        if (fs.existsSync(path.resolve(dir, file))) {
          const postcssConfigPath = path.resolve(dir, file)
          return {
            sourceMap: this.cssSourceMap,
            config: {
              path: postcssConfigPath
            }
          }
        }
      }
    }
  }

  normalize(config) {
    if (Array.isArray(config)) {
      config = { plugins: config }
    }
    return config
  }

  loadPlugins(config) {
    const plugins = config.plugins
    if (isPureObject(plugins)) {
      // Map postcss plugins into instances on object mode once
      config.plugins = Object.keys(plugins)
        .map((p) => {
          const plugin = require(p)
          const opts = plugins[p]
          if (opts === false) return // Disabled
          const instance = plugin(opts)
          return instance
        })
        .filter(e => e)
    }
  }

  config() {
    /* istanbul ignore if */
    if (!this.postcss) {
      return false
    }

    let config = this.configFromFile()
    if (config) {
      return config
    }

    config = this.normalize(_.cloneDeep(this.postcss))

    // Apply default plugins
    if (isPureObject(config)) {
      if (config.preset) {
        this.preset = config.preset
        delete config.preset
      }
      _.defaults(config, this.defaultConfig)

      this.loadPlugins(config)
    }

    return config
  }
}
