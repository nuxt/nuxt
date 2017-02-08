'use strict'

const http = require('http')
const https = require('https')

class Server {
  constructor (nuxt, server, isUserListen) {
    this.nuxt = nuxt
    if (server instanceof http.Server && server instanceof https.Server) {
      this.isUserListen = isUserListen === void 0 ? true : isUserListen
      this.server = server
    } else {
      this.isUserListen = false
      this.server = http.createServer()
    }
    this.server.on('request', this.render.bind(this))
    return this
  }

  render (req, res) {
    this.nuxt.render(req, res)
    return this
  }

  listen (port, host) {
    if (this.isUserListen !== true) {
      host = host || 'localhost'
      port = port || 3000
      this.server.listen(port, host, () => {
        console.log('Ready on http://%s:%s', host, port) // eslint-disable-line no-console
      })
    } else {
      console.log('Please use the incoming server to establish listen') // eslint-disable-line no-console
    }

    return this
  }

  close (cb) {
    return this.server.close(cb)
  }

}

export default Server
