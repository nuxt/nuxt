<script>
export default {
  name: 'nuxt-loading',
  data() {
    return {
      percent: 0,
      show: false,
      canSucceed: true,
      throttle: <%= loading.throttle %>,
      duration: <%= loading.duration %>
    }
  },
  beforeDestroy() {
    this.clear()
  },
  methods: {
    clear() {
      clearInterval(this._timer)
      clearTimeout(this._throttle)
      this._timer = null
    },
    start() {
      this.clear()
      this.percent = 0
      this.canSucceed = true

      if (this.throttle) {
        this._throttle = setTimeout(() => this.startTimer(), this.throttle)
      } else {
        this.startTimer()
      }
      return this
    },
    set(num) {
      this.show = true
      this.canSucceed = true
      this.percent = Math.floor(num)
      return this
    },
    get() {
      return Math.floor(this.percent)
    },
    increase(num) {
      this.percent += Math.floor(num)
      return this
    },
    decrease(num) {
      this.percent -= Math.floor(num)
      return this
    },
    pause() {
      clearInterval(this._timer)
      return this
    },
    resume() {
      this.startTimer()
      return this
    },
    finish() {
      this.percent = 100
      this.hide()
      return this
    },
    hide() {
      this.clear()
      setTimeout(() => {
        this.show = false
        this.$nextTick(() => {
          this.percent = 0
        })
      }, 500)
      return this
    },
    fail() {
      this.canSucceed = false
      return this
    },
    startTimer() {
      if (!this.show) {
        this.show = true
      }
      if (typeof this._cut === 'undefined') {
        this._cut = 10000 / Math.floor(this.duration)
      }
      this._timer = setInterval(() => {
        this.increase(this._cut * Math.random())
        if (this.percent > 95) {
          this.finish()
        }
      }, 100)
    }
  },
  render(h) {
    let el = h(false)
    if (this.show) {
      el = h('div', {
        staticClass: 'nuxt-progress',
        class: {
          'nuxt-progress-failed': !this.canSucceed
        },
        style: {
          'width': this.percent + '%'
        }
      })
    }
    return el
  }
}
</script>
<% if (loading && loading.css) { %>
<style>
.nuxt-progress {
  position: fixed;
  top: 0px;
  left: <%= loading.rtl === true ? 'auto' : '0px' %>;
  right: 0px;
  height: <%= loading.height %>;
  width: 0%;
  transition: width 0.2s, opacity 0.4s;
  opacity: 1;
  background-color: <%= loading.color %>;
  z-index: 999999;
}

.nuxt-progress-failed {
  background-color: <%= loading.failedColor %>;
}
</style><% } %>
