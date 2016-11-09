'use strict'

const http = require('http')
const co = require('co')
const pify = require('pify')
const serveStatic = require('serve-static')
const { resolve } = require('path')

class Server {

  constructor (nuxt) {
    this.server = http.createServer(this.handle.bind(this))
    this.serveStatic = pify(serveStatic(resolve(nuxt.dir, 'static')))
    this.nuxt = nuxt
    return this
  }

  handle (req, res) {
    const method = req.method.toUpperCase()
    const self = this

    if (method !== 'GET' && method !== 'HEAD') {
      return this.nuxt.render(req, res)
    }
    co(function * () {
      if (req.url.includes('/static/')) {
        const url = req.url
        req.url = req.url.replace('/static/', '/')
        yield self.serveStatic(req, res)
        req.url = url
      }
    })
    .then(() => {
      // File not found
      this.nuxt.render(req, res)
    })
  }

  listen (port, host) {
    host = host || 'localhost'
    port = port || 3000
    this.server.listen(port, host, () => {
      console.log('Ready on http://%s:%s', host, port)
    })
  }

}

module.exports = Server
