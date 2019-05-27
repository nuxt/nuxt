<template>
<transition appear>
  <div class="nuxt__hmr" v-if="building">
      <div>Building ({{ progress }}%)</div>
  </div>
</transition>
</template>

<script>
import { setTimeout } from 'timers';
export default {
  data() {
    return {
      building: false,
      progress: 0
    }
  },
  mounted() {
    if (typeof WebSocket === undefined) {
      return // Unsupported
    }
    this.wsConnect('<%= router.base %>_loading/ws')
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
      } catch (e) {}

      this.building = !data.allDone
      this.progress = Math.round(data.states.reduce((p, s) => p + s.progress, 0) / data.states.length)
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
    top: 10px;
    right: 10px;
    background-color: rgb(235, 180, 78);
    padding: 5px;
    border-radius: 5px;
    box-shadow: 0px 0px 5px 0px rgba(0,0,0,0.4);
}

.v-enter-active, .v-leave-active {
  transition-delay: 0.5s;
  transition-property: all;
  transition-duration: 0.6s;
}

.v-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
