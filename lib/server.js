'use strict'

const http = require('http')

class Server {

  constructor (nuxt) {
    this.server = http.createServer(nuxt.render.bind(nuxt))
    return this
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
