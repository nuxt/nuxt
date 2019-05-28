<template>
  <transition appear>
    <div class="nuxt__hmr" v-if="building">
      Building ({{ progress }}%)
    </div>
  </transition>
</template>

<script>
export default {
  data() {
    return {
      building: false,
      progress: 0,
      reconnectAttempts: 0,
    }
  },
  mounted() {
    if (typeof WebSocket === undefined) {
      return // Unsupported
    }
    this.wsConnect('<%= router.base %>_loading/ws')
  },
  beforeDestroy() {
    this.wsClose()
  },
  methods: {
    wsConnect(path) {
      if (path) {
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
        this.wsURL = `${protocol}://${location.hostname}:${location.port}${path}`
      }

      this.ws = new WebSocket(this.wsURL)
      this.ws.onclose = this.onWSClose.bind(this)
      this.ws.onerror = this.onWSError.bind(this)
      this.ws.onmessage = this.onWSMessage.bind(this)
    },

    wsReconnect(e) {
      this.reconnectAttempts++
      if (this.reconnectAttempts > 10) {
        return
      }

      setTimeout(() => {
        this.wsConnect()
      }, 1000)
    },


    onWSClose(e) {
      // https://tools.ietf.org/html/rfc6455#section-11.7
      if (e.code !== 1000 && e.code !== 1005) {
        // Unkown error
        this.wsReconnect()
      }
    },

    onWSError(error) {
      if (error.code === 'ECONNREFUSED') {
        this.wsReconnect(error)
      }
    },

    onWSMessage(msg) {
      let data = msg.data

      try {
        if (data[0] === '{') {
          data = JSON.parse(data)
        }
      } catch (e) {
        return
      }

      this.progress = Math.round(data.states.reduce((p, s) => p + s.progress, 0) / data.states.length)
      this.$nextTick(() => this.building = !data.allDone)
    },

    wsClose() {
      if (this.ws) {
        this.ws.close()
        delete this.ws
      }
    }
  }
}
</script>

<style scopped>
.nuxt__hmr {
  position: absolute;
  font-family: monospace;
  bottom: 0px;
  right: 0px;
  background-color: #2E495E;
  padding: 5px 10px;
  border-top-left-radius: 2px;
  box-shadow: 1px 1px 2px 0px rgba(0,0,0,0.2);
  color: #00C48D;
}
.v-enter-active, .v-leave-active {
  transition-delay: 0.2s;
  transition-property: all;
  transition-duration: 0.3s;
}
.v-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
