export default class BuildContext {
  constructor (builder) {
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
