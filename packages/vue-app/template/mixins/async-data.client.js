import { applyAsyncData } from '../utils'

export default {
  created () {
    if (!this.$options.asyncData || !this.$vnode || !this.$vnode.elm || !this.$vnode.elm.dataset || !this.$vnode.elm.dataset.ssrKey) {
      return
    }
    // Hydrate component
    this._hydrated = true
    this._ssrKey = +this.$vnode.elm.dataset.ssrKey
    const asyncData = this.$nuxt.state.data[this._ssrKey]

    applyAsyncData(this, asyncData)
  },
  // Equivalent of serverPrefetch() since called after `data`
  async beforeMount () {
    if (this._hydrated || !this.$options.asyncData || !this.$options.render) {
      return
    }

    const originalRender = this.$options.render
    this.$options.render = function (h) {
      return h('p', {}, ['Loading...'])
    }
    // Call and apply asyncData on components
    const asyncData = await this.$options.asyncData.call(this, this.$nuxt.$options.context)
    applyAsyncData(this, asyncData)

    // Set back original render function
    this.$options.render = originalRender

    // Force re-rendering of the component
    this.$forceUpdate()
  }
}
