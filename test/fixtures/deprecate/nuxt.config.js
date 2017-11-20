module.exports = {
  modules: [
    '~/modules/hooks'
  ],
  build: {
    extend(config, options) {
      if (options.dev) {
        // Please use isDev instead of dev
      }
    }
  }
}
