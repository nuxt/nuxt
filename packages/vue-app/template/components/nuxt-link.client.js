<%= isTest ? '// @vue/component' : '' %>
import Vue from 'vue'

const requestIdleCallback = window.requestIdleCallback ||
  function (cb) {
    const start = Date.now();
    return setTimeout(function () {
      cb({
        didTimeout: false,
        timeRemaining: function () {
          return Math.max(0, 50 - (Date.now() - start));
        },
      });
    }, 1);
  }
const observer = window.IntersectionObserver && new window.IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) {
      return
    }
    const link = entry.target

    observer.unobserve(link)
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
        this.$el.__prefetch = () => this.prefetch()
        observer.observe(this.$el)
        this.__observed = true
      }
    },
    shouldPrefetch() {
      return this.getPrefetchComponents().length > 0
    },
    getPrefetchComponents() {
      var ref = this.$router.resolve(this.to, this.$route, this.append)
      const Components = ref.resolved.matched.map((r) => r.components.default)

      return Components.filter((Component) => typeof Component === 'function' && !Component.options && !Component.__prefetched)
    },
    prefetch() {
      const Components = this.getPrefetchComponents()

      if (!Components.length) {
        return
      }

      for (let i = 0; i < Components.length; i++) {
        try {
          Components[i]()
          Components[i].__prefetched = true
        } catch (e) {}
      }
    }
  }
}
