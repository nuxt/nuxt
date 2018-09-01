export default {
  head: {
    meta: [
      { content: 'width=device-width,initial-scale=1', name: 'viewport' }
    ]
  },
  router: {
    middleware: ['mobile']
  }
}
