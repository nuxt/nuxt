import path from 'path'

import _ from 'lodash'
import WebpackClientConfig from './client'

export default class WebpackModernConfig extends WebpackClientConfig {
  constructor(builder) {
    super(builder, { name: 'modern', isServer: false, isModern: true })
  }

  getBabelOptions() {
    const options = _.clone(this.options.build.babel)

    options.presets = [
      [
        require.resolve('@nuxtjs/babel-preset-app'),
        {
          modern: true
        }
      ]
    ]

    return options
  }

  optimization() {
    const optimization = super.optimization()

    optimization.runtimeChunk = { name: 'modern-runtime' }

    return optimization
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
