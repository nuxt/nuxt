module.exports = {
  modules: ['~/modules/deprecated-apis'],
  build: {
    stats: false,
    extend(config, options) {
      if (options.dev) {
        // Please use isDev instead of dev
      }
    }
  }
}
