export default class BuildContext {
  constructor(builder) {
    this.nuxt = builder.nuxt
    this.isStatic = false
    this.plugins = builder.plugins
  }
}
