export default {
  async serverPrefetch() {
    // MAYBE: Move this check in beforeCreate and push the serverPrefetch only if declared?
    if (!this.$options || typeof this.$options.asyncData !== 'function') {
      return
    }

    // Define and ssrKey for hydration
    this._ssrKey = this._uid

    // Add data-ssr-key on parent element of Component
    const attrs = this.$vnode.data.attrs = this.$vnode.data.attrs || {}
    attrs['data-ssr-key'] = this._ssrKey

    // Call asyncData & add to ssrContext for window.__NUXT__.asyncData
    const asyncData = this.$data.$asyncData = await this.$options.asyncData.call(this, this.$nuxt.context)
    this.$ssrContext.asyncData[this._ssrKey] = asyncData

    // Overwrite `data` with asyncData result
    const vm = this
    for (const key in asyncData) {
      Object.defineProperty(this, key, {
        get() {
          return vm.$data.$asyncData[key]
        },
        set(value) {
          return vm.$data.$asyncData[key] = value
        },
        enumerable: true,
        configurable: true
      })
    }
  }
}
