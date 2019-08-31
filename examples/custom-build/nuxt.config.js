export default {
  build: {
    filenames: {
      css: 'styles.[chunkhash].css', // default: common.[chunkhash].css
      manifest: 'manifest.[fullhash].js', // default: manifest.[fullhash].js
      app: 'app.[chunkhash].js' // default: nuxt.bundle.[chunkhash].js
    },
    extend (config, { isDev }) {
      if (isDev) {
        config.devtool = 'eval-source-map'
      }

      config.module.rules.some((loader) => {
        if (loader.use) {
          const urlLoader = loader.use.find(use => use.loader === 'url-loader')
          if (urlLoader) {
            // Increase limit to 100KO
            urlLoader.options.limit = 100000
            return true
          }
        }
      })
    }
  }
}
