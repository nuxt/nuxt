const { existsSync } = require('fs')
const { resolve, join } = require('path')
const { cloneDeep } = require('lodash')
const { isPureObject } = require('../../common/utils')
const createResolver = require('postcss-import-resolver')

module.exports = function postcssConfig() {
  let config = cloneDeep(this.options.build.postcss)

  /* istanbul ignore if */
  if (!config) {
    return false
  }

  // Search for postCSS config file and use it if exists
  // https://github.com/michael-ciniawsky/postcss-load-config
  for (let dir of [this.options.srcDir, this.options.rootDir]) {
    for (let file of [
      'postcss.config.js',
      '.postcssrc.js',
      '.postcssrc',
      '.postcssrc.json',
      '.postcssrc.yaml'
    ]) {
      if (existsSync(resolve(dir, file))) {
        const postcssConfigPath = resolve(dir, file)
        return {
          sourceMap: this.options.build.cssSourceMap,
          config: {
            path: postcssConfigPath
          }
        }
      }
    }
  }

  // Normalize
  if (Array.isArray(config)) {
    config = { plugins: config }
  }

  // Apply default plugins
  if (isPureObject(config)) {
    config = Object.assign(
      {
        useConfigFile: false,
        sourceMap: this.options.build.cssSourceMap,
        plugins: {
          // https://github.com/postcss/postcss-import
          'postcss-import': {
            resolve: createResolver({
              alias: {
                '~': join(this.options.srcDir),
                '~~': join(this.options.rootDir),
                '@': join(this.options.srcDir),
                '@@': join(this.options.rootDir)
              },
              modules: [
                this.options.srcDir,
                this.options.rootDir,
                ...this.options.modulesDir
              ]
            })
          },

          // https://github.com/postcss/postcss-url
          'postcss-url': {},

          // http://cssnext.io/postcss
          'postcss-cssnext': {}
        }
      },
      config
    )
  }

  // Map postcss plugins into instances on object mode once
  if (isPureObject(config) && isPureObject(config.plugins)) {
    config.plugins = Object.keys(config.plugins)
      .map(p => {
        const plugin = require(this.nuxt.resolvePath(p))
        const opts = config.plugins[p]
        if (opts === false) return // Disabled
        const instance = plugin(opts)
        return instance
      })
      .filter(e => e)
  }

  return config
}
