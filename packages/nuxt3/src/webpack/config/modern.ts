import WebpackClientConfig from './client'

export default class WebpackModernConfig extends WebpackClientConfig {
  constructor (...args) {
    super(...args)
    this.name = 'modern'
    this.isModern = true
  }

  env () {
    return Object.assign(super.env(), {
      'process.modern': true
    })
  }
}
