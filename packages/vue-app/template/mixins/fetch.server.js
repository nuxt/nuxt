import Vue from 'vue'
import { hasFetch, normalizeError, addLifecycleHook, purifyData } from '../utils'

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
  this._fetchKey = this.$ssrContext.nuxt.fetch.length

  // Add data-fetch-key on parent element of Component
  const attrs = this.$vnode.data.attrs = this.$vnode.data.attrs || {}
  attrs['data-fetch-key'] = this._fetchKey

  // Add to ssrContext for window.__NUXT__.fetch
  this.$ssrContext.nuxt.fetch.push(this.$fetchState.error ? { _error: this.$fetchState.error } : purifyData(this._data))
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
