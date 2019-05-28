<template>
  <transition appear>
    <div class="nuxt__build_indicator" v-if="building">
      <svg viewBox="0 0 96 72" version="1" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" fill-rule="evenodd">
          <path d="M6 66h23l1-3 21-37L40 6 6 66zM79 66h11L62 17l-5 9 22 37v3zM54 31L35 66h38z"/>
          <path d="M29 69v-1-2H6L40 6l11 20 3-6L44 3s-2-3-4-3-3 1-5 3L1 63c0 1-2 3 0 6 0 1 2 2 5 2h28c-3 0-4-1-5-2z" fill="#00C58E"/>
          <path d="M95 63L67 14c0-1-2-3-5-3-1 0-3 0-4 3l-4 6 3 6 5-9 28 49H79a5 5 0 0 1 0 3c-2 2-5 2-5 2h16c1 0 4 0 5-2 1-1 2-3 0-6z" fill="#00C58E"/>
          <path d="M79 69v-1-2-3L57 26l-3-6-3 6-21 37-1 3a5 5 0 0 0 0 3c1 1 2 2 5 2h40s3 0 5-2zM54 31l19 35H35l19-35z" fill="#FFF" fill-rule="nonzero"/>
        </g>
      </svg>
      {{ animatedProgress }}%
    </div>
  </transition>
</template>

<script>
export default {
  name: 'nuxt-build-indicator',
  data() {
    return {
      building: false,
      progress: 0,
      animatedProgress: 0,
      reconnectAttempts: 0,
    }
  },
  mounted() {
    if (WebSocket === undefined) {
      return // Unsupported
    }
    this.wsConnect('<%= router.base %>_loading/ws')
  },
  beforeDestroy() {
    this.wsClose()
  },
  watch: {
    progress(val, oldVal) {
      // Cancel old animation
      if (this._progressAnimation) {
        clearInterval(this._progressAnimation)
      }
      // Average progress may decrease but ignore it!
      if (val < oldVal) {
        return
      }
      // Jump to edge imediately
      if (val < 10 || val > 90) {
        this.animatedProgress = val
      }
      // Animate to value
      this._progressAnimation = setInterval(() => {
        const diff = this.progress - this.animatedProgress
        if (diff > 0) {
          this.animatedProgress++
        }
      }, 50)
    }
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
      setTimeout(() => { this.wsConnect() }, 1000)
    },

    onWSClose(e) {
      // https://tools.ietf.org/html/rfc6455#section-11.7
      if (e.code !== 1000 && e.code !== 1005) {
        this.wsReconnect() // Unkown error
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
      if (!data.allDone) {
        this.building = true
      } else {
        this.$nextTick(() => {
          this.building = false
          this.animatedProgress = 0
          this.progress = 0
        })
      }
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
.nuxt__build_indicator {
  position: absolute;
  font-family: monospace;
  bottom: 20px;
  right: 20px;
  background-color: #2E495E;
  padding: 5px 10px;
  border-radius: 2px;
  box-shadow: 1px 1px 2px 0px rgba(0,0,0,0.2);
  color: #00C48D;
  width: 54px;
}
.v-enter-active, .v-leave-active {
  transition-delay: 0.2s;
  transition-property: all;
  transition-duration: 0.3s;
}
.v-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
svg {
  width: 1.1em;
  position: relative;
  top: 1px;
}
</style>
