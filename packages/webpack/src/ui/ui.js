import WebSocket from 'ws'
import BuilderUIReporter from './reporter'

export default class BuilderUI {
  constructor() {
    this.middleware = this.middleware.bind(this)
    this.reporter = new BuilderUIReporter()
    this.ws = new WebSocket.Server({ noServer: true })

    this.reporter.on('update', () => this.broadcast())
  }

  get data() {
    return {
      states: this.reporter.states
    }
  }

  broadcast() {
    const data = JSON.stringify(this.data)

    for (const client of this.ws.clients) {
      try {
        client.send(data)
      } catch (err) {
        // Ignore error (if client not ready to receive event)
      }
    }
  }

  middleware(req, res) {
    if (req.url.match(/\/ws$/)) {
      return this.ws.handleUpgrade(req, req.socket, req.headers, (client) => {
        this.ws.emit('connection', client, req)
        this.broadcast()
      })
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(this.data))
  }
}
