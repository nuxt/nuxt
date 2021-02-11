import Vue from 'vue'
import { hasFetch, normalizeError, addLifecycleHook, purifyData, createGetCounter } from '../utils'

async function serverPrefetch() {
  if (!this._fetchOnServer) {
    return
  }

  // Call and await on $fetch
  try {
    await this.$options.fetch.call(this)
  } catch (err) {
    if (process.dev) {
      console.error('Error in fetch():', err)
    }
    this.$fetchState.error = normalizeError(err)
  }
  this.$fetchState.pending = false


  // Define an ssrKey for hydration
  this._fetchKey = this._fetchKey || this.$ssrContext.fetchCounters['']++

  // Add data-fetch-key on parent element of Component
  const attrs = this.$vnode.data.attrs = this.$vnode.data.attrs || {}
  attrs['data-fetch-key'] = this._fetchKey

  // Add to ssrContext for window.__NUXT__.fetch
  <% if (debug) { %>
  if (this.$ssrContext.nuxt.fetch[this._fetchKey] !== undefined) {
    console.warn(`Duplicate fetch key detected (${this._fetchKey}). This may lead to unexpected results.`)
  }
  <% } %>
  this.$ssrContext.nuxt.fetch[this._fetchKey] =
    this.$fetchState.error ? { _error: this.$fetchState.error } : purifyData(this._data)
}

export default {
  created() {
    if (!hasFetch(this)) {
      return
    }

    if (typeof this.$options.fetchOnServer === 'function') {
      this._fetchOnServer = this.$options.fetchOnServer.call(this) !== false
    } else {
      this._fetchOnServer = this.$options.fetchOnServer !== false
    }

    const defaultKey = this.$options._scopeId || this.$options.name || ''
    const getCounter = createGetCounter(this.$ssrContext.fetchCounters, defaultKey)

    if (typeof this.$options.fetchKey === 'function') {
      this._fetchKey = this.$options.fetchKey.call(this, getCounter)
    } else {
      const key = 'string' === typeof this.$options.fetchKey ? this.$options.fetchKey : defaultKey
      this._fetchKey = key ? key + ':' + getCounter(key) : String(getCounter(key))
    }

    // Added for remove vue undefined warning while ssr
    this.$fetch = () => {} // issue #8043
    Vue.util.defineReactive(this, '$fetchState', {
      pending: true,
      error: null,
      timestamp: Date.now()
    })

    addLifecycleHook(this, 'serverPrefetch', serverPrefetch)
  }
}
