import http from 'http'
import https from 'https'
import enableDestroy from 'server-destroy'
import ip from 'ip'
import consola from 'consola'
import pify from 'pify'

export default class Listener {
  constructor({ port, host, socket, https, app }) {
    // Options
    this.port = port
    this.host = host
    this.socket = socket
    this.https = https
    this.app = app

    // After listen
    this.listening = false
    this._server = null
    this.server = null
    this.address = null
    this.url = null
  }

  async close() {
    // Destroy server by forcing every connection to be closed
    if (this.server.listening) {
      await this.server.destroy()
      consola.debug('server closed')
    }
  }

  computeURL() {
    const address = this.server.address()
    if (!this.socket) {
      switch (address.address) {
        case '127.0.0.1': this.host = 'localhost'; break
        case '0.0.0.0': this.host = ip.address(); break
      }
      this.url = `http${this.https ? 's' : ''}://${this.host}:${this.port}`
      return
    }
    this.url = `unix+http://${address}`
  }

  async listen() {
    // Prevent multi calls
    if (this.listening) {
      return
    }

    // Initialize underlying http(s) server
    const protocol = this.https ? https : http
    const protocolOpts = typeof this.https === 'object' ? [ this.https ] : []
    this._server = protocol.createServer.apply(protocol, protocolOpts.concat(this.app))

    // Prepare listenArgs
    const listenArgs = this.socket ? { path: this.socket } : { host: this.host, port: this.port }
    listenArgs.exclusive = false

    // Call server.listen
    this.server = await new Promise((resolve, reject) => {
      const s = this._server.listen(listenArgs, error => error ? reject(error) : resolve(s))
    })

    // Enable destroy support
    enableDestroy(this.server)
    pify(this.server.destroy)

    this.computeURL()

    // Set this.listening to true
    this.listening = true
  }
}
