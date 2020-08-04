import ServerContext from 'nuxt/server/context'

export default class BaseRenderer {
  serverContext: ServerContext
  options: ServerContext['options']

  constructor (serverContext: ServerContext) {
    this.serverContext = serverContext
    this.options = serverContext.options
  }

  renderTemplate (templateFn: (options: Record<string, any>) => void, opts: Record<string, any>) {
    // Fix problem with HTMLPlugin's minify option (#3392)
    opts.html_attrs = opts.HTML_ATTRS
    opts.head_attrs = opts.HEAD_ATTRS
    opts.body_attrs = opts.BODY_ATTRS

    return templateFn(opts)
  }

  render (renderContext) {
    throw new Error('`render()` needs to be implemented')
  }
}
