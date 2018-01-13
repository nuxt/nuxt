module.exports = {
  modules: ['~/modules/hooks'],
  build: {
    stats: false,
    extend(config, options) {
      if (options.dev) {
        // Please use isDev instead of dev
      }
    }
  }
}
