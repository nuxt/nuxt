'use strict'

const http = require('http')
const connect = require('connect')

class Server {
  constructor (nuxt) {
    this.nuxt = nuxt
    // Initialize
    this.app = connect()
    this.server = http.createServer(this.app)
    // Add Middlewares
    this.nuxt.options.middlewares.forEach(m => {
      if (m instanceof Function) {
        this.app.use(m)
      } else if (m && m.path && m.handler) {
        this.app.use(m.path, m.handler)
      }
    })
    // Add default render middleware
    this.app.use(this.render.bind(this))
    return this
  }

  render (req, res, next) {
    this.nuxt.render(req, res)
    return this
  }

  listen (port, host) {
    host = host || '127.0.0.1'
    port = port || 3000
    this.server.listen(port, host, () => {
      console.log('Ready on http://%s:%s', host, port) // eslint-disable-line no-console
    })
    return this
  }

  close (cb) {
    return this.server.close(cb)
  }
}

export default Server
