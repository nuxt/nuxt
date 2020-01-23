import Vue from 'vue'
import { hasFetch } from '../utils'

const isSsrHydration = (vm) => vm.$vnode && vm.$vnode.elm && vm.$vnode.elm.dataset && vm.$vnode.elm.dataset.ssrKey
const nuxtState = window.<%= globals.context %>

export default {
  beforeCreate () {
    if (hasFetch(this)) {
      this._fetchDelay = typeof this.$options.fetchDelay === 'number' ? this.$options.fetchDelay : 200
      Vue.util.defineReactive(this, '$fetchState', {
        pending: false,
        error: null,
        timestamp: Date.now()
      })
    }
  },
  created () {
    if (hasFetch(this) && isSsrHydration(this)) {
      // Hydrate component
      this._hydrated = true
      this._ssrKey = +this.$vnode.elm.dataset.ssrKey
      const data = nuxtState.data[this._ssrKey]

      // If fetch error
      if (data && data._error) {
        this.$fetchState.error = data._error
        return
      }
      for (const key in data) {
        this[key] = data[key]
      }
    }
  },
  beforeMount () {
    if (!this._hydrated && hasFetch(this)) {
      this.$fetch()
    }
  },
  methods: {
    async '$fetch' () {
      if (!this.$options.fetch) {
        return console.warn('$fetch: fetch() hook is not implemented')
      }
      this.$nuxt.nbFetching++
      this.$fetchState.pending = true
      this.$fetchState.error = null
      this._hydrated = false
      try {
        const startTime = Date.now()
        await this.$options.fetch.call(this)
        const delayLeft = this._fetchDelay - (Date.now() - startTime)
        if (delayLeft > 0) {
          await new Promise(resolve => setTimeout(resolve, delayLeft))
        }
      } catch (err) {
        this.$fetchState.error = err
      }
      this.$fetchState.pending = false
      this.$fetchState.timestamp = Date.now()
      this.$nextTick(() => this.$nuxt.nbFetching--)
    }
  }
}
