<%= isTest ? '// @vue/component' : '' %>
import Vue from 'vue'

const requestIdleCallback = window.requestIdleCallback ||
  function (cb) {
    const start = Date.now()
    return setTimeout(function () {
      cb({
        didTimeout: false,
        timeRemaining: function () {
          return Math.max(0, 50 - (Date.now() - start))
        },
      })
    }, 1)
  }
const observer = window.IntersectionObserver && new window.IntersectionObserver(entries => {
  entries.forEach(({ isIntersecting, target: link }) => {
    if (!isIntersecting) {
      return
    }
    link.__prefetch()
  })
})

export default {
  extends: Vue.component('RouterLink'),
  name: 'NuxtLink',
  props: {
    noPrefetch: {
      type: Boolean,
      default: false
    }
  },
  mounted() {
    if (!this.noPrefetch) {
      requestIdleCallback(this.observe, { timeout: 2e3 })
    }
  },
  beforeDestroy() {
    if (this.__observed) {
      observer.unobserve(this.$el)
      delete this.$el.__prefetch
    }
  },
  methods: {
    observe() {
      // If no IntersectionObserver, prefetch directly
      if (!observer) {
        return this.prefetch()
      }
      // Add to observer
      if (this.shouldPrefetch()) {
        this.$el.__prefetch = this.prefetch.bind(this)
        observer.observe(this.$el)
        this.__observed = true
      }
    },
    shouldPrefetch() {
      return this.getPrefetchComponents().length > 0
    },
    canPrefetch() {
      const conn = navigator.connection

      // Don't prefetch if the user is on 2G. or if Save-Data is enabled..
      if (conn && ((conn.effectiveType || '').includes('2g') || conn.saveData)) {
        return false
      }
      return true
    },
    getPrefetchComponents() {
      const ref = this.$router.resolve(this.to, this.$route, this.append)
      const Components = ref.resolved.matched.map((r) => r.components.default)

      return Components.filter((Component) => typeof Component === 'function' && !Component.options && !Component.__prefetched)
    },
    prefetch() {
      if (!this.canPrefetch()) {
        return
      }
      // Stop obersing this link (in case of internet connection changes)
      observer.unobserve(this.$el)
      const Components = this.getPrefetchComponents()

      for (const Component of Components) {
        try {
          Component()
          Component.__prefetched = true
        } catch (e) {}
      }
    }
  }
}
