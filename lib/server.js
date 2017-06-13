const http = require('http')
const connect = require('connect')
const path = require('path')

class Server {
  constructor (nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options

    // Initialize
    this.app = connect()
    this.server = http.createServer(this.app)
    this.nuxt.init()
      .then(() => {
        // Add Middleware
        this.options.serverMiddleware.forEach(m => {
          this.useMiddleware(m)
        })
        // Add default render middleware
        this.useMiddleware(this.render.bind(this))
      })
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
      // eslint-disable-next-line no-eval
      m = eval('require')(src)
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
    this.nuxt.init()
    .then(() => {
      this.server.listen(port, host, () => {
        let _host = host === '0.0.0.0' ? 'localhost' : host
        console.log('Ready on http://%s:%s', _host, port) // eslint-disable-line no-console
      })
    })
    return this
  }

  close (cb) {
    return this.server.close(cb)
  }
}

export default Server
