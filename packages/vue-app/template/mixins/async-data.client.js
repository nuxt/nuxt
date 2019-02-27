import { applyAsyncData } from '../utils'

export default {
  async created() {
    if (!this.$options.asyncData || !this.$vnode || !this.$vnode.elm || !this.$vnode.elm.dataset || !this.$vnode.elm.dataset.ssrKey) {
      return
    }
    // Hydrate component
    this._ssrKey = +this.$vnode.elm.dataset.ssrKey
    const asyncData = this.$nuxt.state.data[this._ssrKey]

    applyAsyncData(this, asyncData)
  }
}
