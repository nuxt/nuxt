import http from 'http'
import https from 'https'
import type { ListenOptions } from 'net'
import enableDestroy from 'server-destroy'
import ip from 'ip'
import consola from 'consola'
import pify from 'pify'

import type { NormalizedConfiguration } from 'src/config'

let RANDOM_PORT = '0'

interface ListenerOptions {
  port: number | string
  host: string
  socket: string
  https: NormalizedConfiguration['server']['https']
  app: any
  dev: boolean
  baseURL: string
}

export default class Listener {
  port: number | string
  host: string
  socket: string
  https: NormalizedConfiguration['server']['https']
  app: any
  dev: boolean
  baseURL: string

  listening: boolean
  _server: null | http.Server
  server: null | http.Server
  address: null
  url: null | string
  constructor ({ port, host, socket, https, app, dev, baseURL }: ListenerOptions) {
    // Options
    this.port = port
    this.host = host
    this.socket = socket
    this.https = https
    this.app = app
    this.dev = dev
    this.baseURL = baseURL

    // After listen
    this.listening = false
    this._server = null
    this.server = null
    this.address = null
    this.url = null
  }

  async close () {
    // Destroy server by forcing every connection to be closed
    if (this.server && this.server.listening) {
      await this.server.destroy()
      consola.debug('server closed')
    }

    // Delete references
    this.listening = false
    this._server = null
    this.server = null
    this.address = null
    this.url = null
  }

  computeURL () {
    const address = this.server.address()
    if (typeof address === 'string') {
      return address
    }
    if (!this.socket) {
      switch (address.address) {
        case '127.0.0.1': this.host = 'localhost'; break
        case '0.0.0.0': this.host = ip.address(); break
      }
      this.port = address.port
      this.url = `http${this.https ? 's' : ''}://${this.host}:${this.port}${this.baseURL}`
      return
    }
    this.url = `unix+http://${address}`
  }

  async listen () {
    // Prevent multi calls
    if (this.listening) {
      return
    }

    // Initialize underlying http(s) server
    const protocol = this.https ? https : http
    const protocolOpts = this.https ? [this.https] : []
    this._server = protocol.createServer.apply(protocol, protocolOpts.concat(this.app))

    // Call server.listen
    // Prepare listenArgs
    const listenArgs: ListenOptions = this.socket ? { path: this.socket } : { host: this.host, port: Number(this.port) }
    listenArgs.exclusive = false

    // Call server.listen
    try {
      this.server = await new Promise((resolve, reject) => {
        this._server.on('error', error => reject(error))
        const s = this._server.listen(listenArgs, () => resolve(s))
      })
    } catch (error) {
      return this.serverErrorHandler(error)
    }

    // Enable destroy support
    enableDestroy(this.server)
    pify(this.server.destroy)

    // Compute listen URL
    this.computeURL()

    // Set this.listening to true
    this.listening = true
  }

  async serverErrorHandler (error) {
    // Detect if port is not available
    const addressInUse = error.code === 'EADDRINUSE'

    // Use better error message
    if (addressInUse) {
      const address = this.socket || `${this.host}:${this.port}`
      error.message = `Address \`${address}\` is already in use.`

      // Listen to a random port on dev as a fallback
      if (this.dev && !this.socket && this.port !== RANDOM_PORT) {
        consola.warn(error.message)
        consola.info('Trying a random port...')
        this.port = RANDOM_PORT
        await this.close()
        await this.listen()
        RANDOM_PORT = this.port
        return
      }
    }

    // Throw error
    throw error
  }
}
