import clone from 'lodash/clone'
import WebpackClientConfig from './client'

export default class WebpackModernConfig extends WebpackClientConfig {
  constructor(...args) {
    super(...args)
    this.name = 'modern'
    this.isModern = true
  }

  env() {
    return Object.assign(super.env(), {
      'process.modern': true
    })
  }

  getBabelOptions() {
    const options = clone(this.buildContext.buildOptions.babel)

    options.presets = [
      [
        require.resolve('@nuxt/babel-preset-app'),
        {
          modern: true
        }
      ]
    ]

    return options
  }
}
