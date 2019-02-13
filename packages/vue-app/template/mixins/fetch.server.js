export default {
  async serverPrefetch() {
    // Backward compatibility
    if (this.$options && typeof this.$options.fetch === 'function') {
      await this.$options.fetch.call(this, this.$nuxt.context)
    }
  }
}
