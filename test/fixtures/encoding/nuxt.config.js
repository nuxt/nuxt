export default {
  router: {
    base: '/ö/'
  },
  hooks: {
    'vue-renderer:context' (ssrContext) {
      if (ssrContext.url.includes('?spa')) {
        ssrContext.spa = true
      }
    }
  }
}
