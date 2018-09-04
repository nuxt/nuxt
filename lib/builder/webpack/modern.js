import path from 'path'

import _ from 'lodash'
import WebpackClientConfig from './client'

export default class WebpackModernConfig extends WebpackClientConfig {
  constructor(builder) {
    super(builder, { name: 'modern', isServer: false })
  }

  getBabelOptions() {
    const options = _.clone(this.options.build.babel)

    if (typeof options.presets === 'function') {
      options.presets = options.presets({ isServer: false })
    }

    if (!options.babelrc && !options.presets) {
      options.presets = [
        [
          require.resolve('@nuxtjs/babel-preset-app'),
          {
            targets: { esmodules: true }
          }
        ]
      ]
    }

    return options
  }

  config() {
    const config = super.config()

    // Entry points
    config.entry = {
      'modern-app': [path.resolve(this.options.buildDir, 'client.js')]
    }

    return this.customize(config)
  }
}
