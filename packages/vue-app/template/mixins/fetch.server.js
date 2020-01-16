import Vue from 'vue'
import { hasFetch } from '../utils'

function getDataDiff(o1, o2) {
  return Object.keys(o2).reduce((diff, key) => {
    if (o1[key] === o2[key]) {
      return diff
    }
    return {
      ...diff,
      [key]: o2[key]
    }
  }, {})
}

export default {
  beforeCreate () {
    if (hasFetch(this)) {
      this._fetchOnServer = this.$options.fetchOnServer !== false
      this.$isFetching = !this._fetchOnServer
      Vue.util.defineReactive(this, '$fetchError', null)
    }
  },
  async serverPrefetch () {
    if (hasFetch(this) && this._fetchOnServer) {
      const data = Object.assign({}, this.$data)

      try {
        await this.$options.fetch.call(this)
      } catch (err) {
        this.$fetchError = err
      }
      // Define and ssrKey for hydration
      this._ssrKey = this.$ssrContext.nuxt.data.length

      // Add data-ssr-key on parent element of Component
      const attrs = this.$vnode.data.attrs = this.$vnode.data.attrs || {}
      attrs['data-ssr-key'] = this._ssrKey

      // Call asyncData & add to ssrContext for window.__NUXT__.asyncData
      this.$ssrContext.nuxt.data.push(this.$fetchError ? { _error: this.$fetchError } : getDataDiff(data, this.$data))
    }
  }
}
