export default {
  methods: {
    logWS(...args) {
      this.log('[WS]', ...args)
    },

    logWSError(...args) {
      this.logError('[WS]', ...args)
    },

    wsConnect(path) {
      this.logWS('Connecting...')

      this.wsURL = `ws://${location.hostname}:${location.port}${path}`

      this.ws = new WebSocket(this.wsURL)

      this.ws.onopen = this.onWSOpen.bind(this)
      this.ws.onclose = this.onWSClose.bind(this)
      this.ws.onerror = this.onWSError.bind(this)
      this.ws.onmessage = this.onWSMessage.bind(this)
    },

    wsReconnect(e) {
      const interval = this.autoReconnectInterval || 1000

      this.logWS(`Retry in ${interval}ms`, e)

      setTimeout(() => {
        this.logWS('Reconnecting...')
        this.wsConnect()
      }, this.interval)
    },

    onWSOpen(e) {
      this.logWS('Connected!')
      this.wsConnected = true
    },

    onWSClose(e) {
      this.wsConnected = false

      this.logWS('Code: ', e.code) // TODO

      // https://tools.ietf.org/html/rfc6455#section-11.7
      if (e.code === 1000 || e.code === 1005) {
        // Normal close
        this.logWS('Closed!')
      } else {
        // Unkown error
        this.wsReconnect()
      }
    },

    onWSError(e) {
      switch (e.code) {
        case 'ECONNREFUSED':
          this.reconnect(e)
          break
        default:
          this.logWSError('Error:', e)
          break
      }
    },

    onWSMessage(msg) {
      let data = msg.data

      try {
        if (data[0] === '{') {
          data = JSON.parse(data)
        }
      } catch (e) {
        this.logWSError('Message parse error:', e, msg.data)
      }

      if (this.onWSData) {
        this.onWSData(data)
      }
    }
  }
}
