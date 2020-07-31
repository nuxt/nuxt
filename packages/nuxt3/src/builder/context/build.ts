import type Builder from '../builder'

export default class BuildContext {
  _builder: Builder
  nuxt: Builder['nuxt']
  options: Builder['nuxt']['options']
  target: Builder['nuxt']['options']['target']
  
  constructor (builder: Builder) {
    this._builder = builder
    this.nuxt = builder.nuxt
    this.options = builder.nuxt.options
    this.target = builder.nuxt.options.target
  }

  get buildOptions () {
    return this.options.build
  }

  get plugins () {
    return this._builder.plugins
  }
}
