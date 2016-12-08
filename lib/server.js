'use strict'

const http = require('http')

class Server {

  constructor (nuxt) {
    this.nuxt = nuxt
    this.server = http.createServer(this.render.bind(this))
    return this
  }

  render (req, res) {
    this.nuxt.render(req, res)
    return this
  }

  listen (port, host) {
    host = host || 'localhost'
    port = port || 3000
    this.server.listen(port, host, () => {
      console.log('Ready on http://%s:%s', host, port) // eslint-disable-line no-console
    })
    return this
  }

}

module.exports = Server
