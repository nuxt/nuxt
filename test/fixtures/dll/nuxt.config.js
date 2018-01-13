module.exports = {
  build: {
    stats: false,
    dll: true,
    extend(config, options) {
      if (options.isClient) {
        const dlls = config.plugins.filter(
          plugin => plugin.constructor.name === 'DllReferencePlugin'
        )
        console.log('Using dll for ' + dlls.length + ' libs') // eslint-disable-line no-console
      }
      return config
    }
  }
}
