import path from 'path'
import connect from 'connect'
import fs from 'fs-extra'
import serveStatic from 'serve-static'
import { Server as WebSocketServer } from 'ws'

const assetsDir = path.resolve(__dirname, '..', 'assets')
const resolveAsset = rp => path.join(assetsDir, rp)

export class NuxtUI {
  constructor(nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options

    this.middleware = this.middleware.bind(this)

    this.states = []

    nuxt.hook('bundler:progress', (states) => {
      this.states = states
      this.broadcastState()
    })
  }

  async init() {
    this.wss = new WebSocketServer({ noServer: true })

    this.app = connect()
    this.app.use('/assets', serveStatic(assetsDir))
    this.app.use('/loading', this.renderLoadingPage.bind(this))
    this.app.use('/', this.renderState.bind(this))

    this.loadingPageTemplate = await fs.readFile(resolveAsset('html/loading.html'), 'utf-8')
  }

  get state() {
    return {
      states: this.states
    }
  }

  broadcastState() {
    const data = JSON.stringify(this.state)

    for (const client of this.wss.clients) {
      try {
        client.send(data)
      } catch (err) {
        // Ignore error (if client not ready to receive event)
      }
    }
  }

  renderLoadingPage(req, res) {
    // Template for loading screen
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(this.loadingPageTemplate)
  }

  renderState(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(this.state, null, 2))
  }

  middleware(req, res) {
    if (req.url.match(/\/ws$/)) {
      return this.wss.handleUpgrade(req, req.socket, req.headers, (client) => {
        this.wss.emit('connection', client, req)
        this.broadcastState()
      })
    }
    this.app(req, res)
  }
}
