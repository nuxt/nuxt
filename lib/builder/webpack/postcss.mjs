import fs from 'fs'
import path from 'path'

import ـ from 'lodash'
import createResolver from 'postcss-import-resolver'

import { isPureObject } from '../../common/utils'

export default function postcssConfig() {
  let config = ـ.cloneDeep(this.options.build.postcss)

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
      if (fs.existsSync(path.resolve(dir, file))) {
        const postcssConfigPath = path.resolve(dir, file)
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
                '~': path.join(this.options.srcDir),
                '~~': path.join(this.options.rootDir),
                '@': path.join(this.options.srcDir),
                '@@': path.join(this.options.rootDir)
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
        const plugin = this.nuxt.requireModule(p)
        const opts = config.plugins[p]
        if (opts === false) return // Disabled
        const instance = plugin(opts)
        return instance
      })
      .filter(e => e)
  }

  return config
}
