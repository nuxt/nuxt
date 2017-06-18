import http from 'http'
import connect from 'connect'
import path from 'path'

class Server {
  constructor (nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options

    // Initialize
    if (nuxt.initialized) {
      // If nuxt already initialized
      this._ready = this.ready().catch(this.nuxt.errorHandler)
    } else {
      // Wait for hook
      this.nuxt.plugin('afterInit', () => {
        this._ready = this.ready()
        return this._ready
      })
    }
  }

  async ready () {
    if (this._ready) {
      return this._ready
    }

    this.app = connect()
    this.server = http.createServer(this.app)

    // Add Middleware
    this.options.serverMiddleware.forEach(m => {
      this.useMiddleware(m)
    })
    // Add default render middleware
    this.useMiddleware(this.render.bind(this))

    return this
  }

  useMiddleware (m) {
    // Require if needed
    if (typeof m === 'string') {
      let src = m
      // Using ~ or ./ shorthand to resolve from project srcDir
      if (src.indexOf('~') === 0 || src.indexOf('./') === 0) {
        src = path.join(this.nuxt.options.srcDir, src.substr(1))
      }
      m = require(src)
    }
    if (m instanceof Function) {
      this.app.use(m)
    } else if (m && m.path && m.handler) {
      this.app.use(m.path, m.handler)
    }
  }

  render (req, res, next) {
    this.nuxt.render(req, res)
    return this
  }

  listen (port, host) {
    host = host || 'localhost'
    port = port || 3000
    this.nuxt.ready()
      .then(() => {
        this.server.listen(port, host, () => {
          // Renderer calls showURL when server is really ready
          // this.nuxt.showURL(host, port)
        })
      })
      .catch(this.nuxt.errorHandler)
    return this
  }

  close (cb) {
    return this.server.close(cb)
  }
}

export default Server
