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
    this.protocol = null
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

  async listen() {
    // Prevent multi calls
    if (this.listenning) {
      return
    }

    // Initialize undelying http(s) server
    if (this.https) {
      const httpsOptions = this.https === true ? {} : Object.assign({}, this.https)
      this._server = https.createServer(httpsOptions, this.app)
    } else {
      this._server = this.app
    }

    // Prepare listenArgs
    const listenArgs = { exclusive: false }
    if (this.socket) {
      listenArgs.path = this.socket
    } else {
      listenArgs.port = this.port
      listenArgs.host = this.host
    }

    // Call server.listen
    this.server = await new Promise((resolve, reject) => {
      const s = this._server.listen(listenArgs, error => error ? reject(error) : resolve(s))
    })

    // Enable destroy support
    enableDestroy(this.server)
    pify(this.server.destroy)

    // Compute protocol, address and url
    if (!listenArgs.path) {
      const { address, port } = this.server.address()
      this.protocol = 'http' + (this.https ? 's' : '')
      if (address === '127.0.0.1') {
        this.address = 'localhost'
      } else if (address === '0.0.0.0') {
        this.address = ip.address()
      }
      this.address += ':' + port
    } else {
      this.protocol = 'unix+http'
      this.address = listenArgs.path
    }
    this.url = this.protocol + '://' + this.address

    // Set this.listening to true
    this.listening = true
  }
}
