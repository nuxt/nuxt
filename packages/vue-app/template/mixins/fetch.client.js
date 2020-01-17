import Vue from 'vue'
import { hasFetch } from '../utils'

const isSsrHydration = (vm) => vm.$vnode && vm.$vnode.elm && vm.$vnode.elm.dataset && vm.$vnode.elm.dataset.ssrKey
const nuxtState = window.<%= globals.context %>

export default {
  beforeCreate () {
    if (hasFetch(this)) {
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
        return this.$fetchState.error = data._error
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
        return console.warning('$fetch: fetch() hook is not implemented')
      }
      this.$nuxt.nbFetching++
      this.$fetchState.pending = true
      this.$fetchState.error = null
      this._hydrated = false
      try {
        await this.$options.fetch.call(this, this.$nuxt.$options.context)
      } catch (err) {
        this.$fetchState.error = err
      }
      this.$fetchState.pending = false
      this.$fetchState.timestamp = Date.now()
      this.$nextTick(() => this.$nuxt.nbFetching--)
    }
  }
}
