import clone from 'lodash/clone'
import WebpackClientConfig from './client'

export default class WebpackModernConfig extends WebpackClientConfig {
  constructor(builder) {
    super(builder, { name: 'modern', isServer: false, isModern: true })
  }

  env() {
    return Object.assign(super.env(), {
      'process.env.VUE_ENV': JSON.stringify('client'),
      'process.browser': true,
      'process.client': true,
      'process.server': false,
      'process.modern': true
    })
  }

  getBabelOptions() {
    const options = clone(this.options.build.babel)

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
