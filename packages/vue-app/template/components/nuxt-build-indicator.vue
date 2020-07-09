<template>
  <transition appear>
    <div v-if="building" class="nuxt__build_indicator" :style="indicatorStyle">
      <svg viewBox="0 0 96 72" version="1" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" fill-rule="evenodd">
          <path d="M6 66h23l1-3 21-37L40 6 6 66zM79 66h11L62 17l-5 9 22 37v3zM54 31L35 66h38z" />
          <path d="M29 69v-1-2H6L40 6l11 20 3-6L44 3s-2-3-4-3-3 1-5 3L1 63c0 1-2 3 0 6 0 1 2 2 5 2h28c-3 0-4-1-5-2z" fill="#00C58E" />
          <path d="M95 63L67 14c0-1-2-3-5-3-1 0-3 0-4 3l-4 6 3 6 5-9 28 49H79a5 5 0 0 1 0 3c-2 2-5 2-5 2h16c1 0 4 0 5-2 1-1 2-3 0-6z" fill="#00C58E" />
          <path d="M79 69v-1-2-3L57 26l-3-6-3 6-21 37-1 3a5 5 0 0 0 0 3c1 1 2 2 5 2h40s3 0 5-2zM54 31l19 35H35l19-35z" fill="#FFF" fill-rule="nonzero" />
        </g>
      </svg>
      {{ animatedProgress }}%
    </div>
  </transition>
</template>

<script>
export default {
  name: 'NuxtBuildIndicator',
  data () {
    return {
      building: false,
      progress: 0,
      animatedProgress: 0,
      reconnectAttempts: 0
    }
  },
  computed: {
    options: () => (<%= JSON.stringify(buildIndicator) %>),
    indicatorStyle () {
      const [d1, d2] = this.options.position.split('-')
      return {
        [d1]: '20px',
        [d2]: '20px',
        'background-color': this.options.backgroundColor,
        color: this.options.color
      }
    }
  },
  watch: {
    progress (val, oldVal) {
      // Average progress may decrease but ignore it!
      if (val < oldVal) {
        return
      }
      // Cancel old animation
      clearInterval(this._progressAnimation)
      // Jump to edge immediately
      if (val < 10 || val > 90) {
        this.animatedProgress = val
        return
      }
      // Animate to value
      this._progressAnimation = setInterval(() => {
        const diff = this.progress - this.animatedProgress
        if (diff > 0) {
          this.animatedProgress++
        } else {
          clearInterval(this._progressAnimation)
        }
      }, 50)
    }
  },
  mounted () {
    if (EventSource === undefined) {
      return // Unsupported
    }
    this.sseConnect()
  },
  beforeDestroy () {
    this.sseClose()
    clearInterval(this._progressAnimation)
  },
  methods: {
    sseConnect () {
      if (this._connecting) {
        return
      }
      this._connecting = true
      this.sse = new EventSource('<%= nuxtOptions.build.loadingScreen.baseURLAlt %>/sse')
      this.sse.addEventListener('message', event => this.onSseMessage(event))
    },
    onSseMessage (message) {
      const data = JSON.parse(message.data)
      if (!data.states) {
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
          clearInterval(this._progressAnimation)
        })
      }
    },

    sseClose () {
      if (this.sse) {
        this.sse.close()
        delete this.sse
      }
    }
  }
}
</script>

<style scoped>
.nuxt__build_indicator {
  box-sizing: border-box;
  position: fixed;
  font-family: monospace;
  padding: 5px 10px;
  border-radius: 5px;
  box-shadow: 1px 1px 2px 0px rgba(0,0,0,0.2);
  width: 88px;
  z-index: 2147483647;
  font-size: 16px;
  line-height: 1.2rem;
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
  display: inline-block;
  vertical-align: baseline;
  width: 1.1em;
  height: 0.825em;
  position: relative;
  top: 1px;
}
</style>
