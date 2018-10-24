export default class BuildContext {
  constructor(builder) {
    this.nuxt = builder.nuxt
    this.options = builder.nuxt.options
    this.isStatic = false
    this.plugins = builder.plugins
  }
}
