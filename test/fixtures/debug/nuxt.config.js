module.exports = {
  router: {
    base: '/test/'
  },
  debug: true,
  editor: {
    cmd: 'echo',
    pattern: ''
  },
  build: {
    extend(config, ctx) {
      if (ctx.isServer) {
        config.devtool = 'source-map'
      }
    }
  }
}
