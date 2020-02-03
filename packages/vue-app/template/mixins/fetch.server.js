import Vue from 'vue'
import { watchDiff, hasFetch, normalizeError, getDataDiff, addLifecycleHook } from '../utils'

async function serverPrefetch() {
  if (!this._fetchOnServer) {
    return
  }

  const diff = watchDiff(this)
  try {
    await this.$options.fetch.call(this)
  } catch (err) {
    this.$fetchState.error = normalizeError(err)
  }

  // Define an ssrKey for hydration
  this._ssrKey = this.$ssrContext.nuxt.data.length

  // Add data-ssr-key on parent element of Component
  const attrs = this.$vnode.data.attrs = this.$vnode.data.attrs || {}
  attrs['data-ssr-key'] = this._ssrKey

  // Call asyncData & add to ssrContext for window.__NUXT__.asyncData
  this.$ssrContext.nuxt.data.push(this.$fetchState.error ? { _error: this.$fetchState.error } : diff)
}

export default {
  beforeCreate() {
    this._hasFetch = hasFetch(this)
    if (!this._hasFetch) {
      return
    }

    this._fetchOnServer = this.$options.fetchOnServer !== false

    Vue.util.defineReactive(this, '$fetchState', {
      pending: !this._fetchOnServer,
      error: null,
      timestamp: Date.now()
    })

    addLifecycleHook(this, 'serverPrefetch', serverPrefetch)
  }
}
