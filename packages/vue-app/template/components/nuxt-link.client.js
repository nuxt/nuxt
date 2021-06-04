import Vue from 'vue'

const requestIdleCallback = window.requestIdleCallback ||
  function (cb) {
    const start = Date.now()
    return setTimeout(function () {
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
      })
    }, 1)
  }

const cancelIdleCallback = window.cancelIdleCallback || function (id) {
  clearTimeout(id)
}

<%= isTest ? '// @vue/component' : '' %>
export default {
  name: 'NuxtLink',
  extends: Vue.component('RouterLink'),
  props: {
    prefetch: {
      type: Boolean,
      default: <%= router.prefetchLinks ? 'true' : 'false' %>
    },
    noPrefetch: {
      type: Boolean,
      default: false
    }<% if (router.linkPrefetchedClass) { %>,
    prefetchedClass: {
      type: String,
      default: '<%= router.linkPrefetchedClass %>'
    }<% } %>
  },
  data () {
    return {
      __observed: false,
      __unobserve: () => {}
    }
  },
  mounted () {
    if (this.prefetch && !this.noPrefetch) {
      this.handleId = requestIdleCallback(this.observe, { timeout: 2000 })
    }
  },
  beforeDestroy () {
    cancelIdleCallback(this.handleId)

    if (!this.__observed) {
      return
    }
    this.$options.__unobserve(this.$el)
    delete this.$el.__prefetch
  },
  methods: {
    observe () {
      // Add to observer
      if (this.shouldPrefetch()) {
        const unobserveFunctionOrUnavailable = this.$nuxt.context.observer.use(this.$el)
        if(!unobserveFunctionOrUnavailable) {
          return
        }

        this.$options.__unobserve = unobserveFunctionOrUnavailable
        this.$el.__prefetch = this.prefetchLink.bind(this)
        this.__observed = true
      }<% if (router.linkPrefetchedClass) { %> else {
        this.addPrefetchedClass()
      }<% } %>
    },
    shouldPrefetch () {
      <% if (isFullStatic && router.prefetchPayloads) { %>
      const ref = this.$router.resolve(this.to, this.$route, this.append)
      const Components = ref.resolved.matched.map(r => r.components.default)

      return Components.filter(Component => ref.href || (typeof Component === 'function' && !Component.options && !Component.__prefetched)).length
      <% } else { %>return this.getPrefetchComponents().length > 0<% } %>
    },
    canPrefetch () {
      const conn = navigator.connection
      const hasBadConnection = this.<%= globals.nuxt %>.isOffline || (conn && ((conn.effectiveType || '').includes('2g') || conn.saveData))

      return !hasBadConnection
    },
    getPrefetchComponents () {
      const ref = this.$router.resolve(this.to, this.$route, this.append)
      const Components = ref.resolved.matched.map(r => r.components.default)

      return Components.filter(Component => typeof Component === 'function' && !Component.options && !Component.__prefetched)
    },
    prefetchLink () {
      if (!this.canPrefetch()) {
        return
      }
      // Stop observing this link (in case of internet connection changes)
      this.$options.__unobserve(this.$el)
      const Components = this.getPrefetchComponents()
      <% if (router.linkPrefetchedClass) { %>const promises = []<% } %>

      for (const Component of Components) {
        const componentOrPromise = Component()
        if (componentOrPromise instanceof Promise) {
          componentOrPromise.catch(() => {})
          <% if (router.linkPrefetchedClass) { %>promises.push(componentOrPromise)<% } %>
        }
        Component.__prefetched = true
      }
      <% if (isFullStatic && router.prefetchPayloads) { %>
      // Preload the data only if not in preview mode
      if (!this.$root.isPreview) {
        const { href } = this.$router.resolve(this.to, this.$route, this.append)
        if (this.<%= globals.nuxt %>)
          this.<%= globals.nuxt %>.fetchPayload(href, true).catch(() => {})
      }
      <% } %>
      <% if (router.linkPrefetchedClass) { %>
      return Promise.all(promises).then(() => this.addPrefetchedClass())
      <% } %>
    }<% if (router.linkPrefetchedClass) { %>,
    addPrefetchedClass () {
      if (this.prefetchedClass !== 'false') {
        this.$el.className = (this.$el.className + ' ' + this.prefetchedClass).trim()
      }
    }<% } %>
  },
  __unobserve: () => {}
}
