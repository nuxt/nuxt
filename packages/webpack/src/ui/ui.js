import fs from 'fs'
import path from 'path'
import WebSocket from 'ws'
import BuilderUIReporter from './reporter'

export default class BuilderUI {
  constructor() {
    this.middleware = this.middleware.bind(this)
    this.reporter = new BuilderUIReporter()
    this.template = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8')
    this.ws = new WebSocket.Server({ noServer: true })

    this.reporter.on('update', () => { this.broadcast() })
  }

  get data() {
    return {
      states: this.reporter.states
    }
  }

  broadcast() {
    const data = JSON.stringify(this.data)
    for (const client of this.ws.clients) {
      client.send(data)
    }
  }

  middleware(req, res) {
    if (req.url.match(/\/ws$/)) {
      return this.ws.handleUpgrade(req, req.socket, req.headers, (client) => {
        this.ws.emit('connection', client, req)
      })
    }

    const html = this.template.replace('__DATA__', JSON.stringify(this.data))
    res.end(html)
  }
}
