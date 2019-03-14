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
  beforeCreate() {
    if (hasFetch(this)) {
      this._fetchOnServer = this.$options.fetchOnServer !== false
      this.$isFetching = !this._fetchOnServer
    }
  },
  async serverPrefetch() {
    if (hasFetch(this) && this._fetchOnServer) {
      const data = Object.assign({}, this.$data)

      try {
        await this.$options.fetch.call(this, this.$nuxt.$options.context)

        // Define and ssrKey for hydration
        this._ssrKey = this.$nuxt.state.data.length

        // Add data-ssr-key on parent element of Component
        const attrs = this.$vnode.data.attrs = this.$vnode.data.attrs || {}
        attrs['data-ssr-key'] = this._ssrKey

        // Call asyncData & add to ssrContext for window.__NUXT__.asyncData
        this.$nuxt.state.data.push(getDataDiff(data, this.$data))
      } catch (err) {
        console.log('fetch errored')
        this.$nuxt.error(err)
        this.$nuxt.$forceUpdate()
      }
      await new Promise(resolve => this.$nextTick(resolve))
    }
  }
}
