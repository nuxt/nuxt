export default {
  async beforeMount() {
    if (this.$options && typeof this.$options.fetch === 'function') {
      await this.$options.fetch.call(this, this.$nuxt.$options.context)
    }
  }
}
