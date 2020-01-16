import Vue from 'vue'
import { hasFetch } from '../utils'

const isSsrHydration = (vm) => vm.$vnode && vm.$vnode.elm && vm.$vnode.elm.dataset && vm.$vnode.elm.dataset.ssrKey
const nuxtState = window.<%= globals.context %>

export default {
  beforeCreate () {
    if (hasFetch(this)) {
      Vue.util.defineReactive(this, '$isFetching', false)
      Vue.util.defineReactive(this, '$fetchError', null)
    }
  },
  created () {
    if (hasFetch(this) && isSsrHydration(this)) {
      // Hydrate component
      this._hydrated = true
      this.$isLoading = false
      this._lastFetchAt = Date.now()

      this._ssrKey = +this.$vnode.elm.dataset.ssrKey
      const data = nuxtState.data[this._ssrKey]

      // If fetch error
      if (data && data._error) {
        return this.$fetchError = data._error
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
      this.$nuxt.nbFetching++
      this.$isFetching = true
      this.$fetchError = null
      try {
        await this.$options.fetch.call(this, this.$nuxt.$options.context)
      } catch (err) {
        this.$fetchError = err
      }
      this.$isFetching = false
      this._lastFetchAt = Date.now()
      this.$nextTick(() => this.$nuxt.nbFetching--)
    }
  }
}
