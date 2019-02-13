export default {
  async created() {
    if (!this.$vnode || !!this.$vnode.elm || !this.$vnode.elm.dataset.ssrKey) {
      return
    }
    this._ssrKey = this.$vnode.elm.dataset.ssrKey
    const asyncData = this.$data.$asyncData = this.$nuxt.ssrState.data[this._ssrKey]
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
