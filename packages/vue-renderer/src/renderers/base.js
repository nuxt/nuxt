export default class BaseRenderer {
  constructor (serverContext) {
    this.serverContext = serverContext
    this.options = serverContext.options

    this.vueRenderer = this.createRenderer()
  }

  createRenderer () {
    throw new Error('`createRenderer()` needs to be implemented')
  }

  renderTemplate (templateFn, opts) {
    // Fix problem with HTMLPlugin's minify option (#3392)
    opts.html_attrs = opts.HTML_ATTRS
    opts.head_attrs = opts.HEAD_ATTRS
    opts.body_attrs = opts.BODY_ATTRS

    return templateFn(opts)
  }

  render () {
    throw new Error('`render()` needs to be implemented')
  }
}
