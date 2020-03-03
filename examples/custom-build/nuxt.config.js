export default {
  build: {
    filenames: {
      css: 'styles.[contenthash].css', // default: common.[contenthash].css
      manifest: 'manifest.[contenthash].js', // default: manifest.[contenthash].js
      app: 'app.[contenthash].js' // default: nuxt.bundle.[contenthash].js
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
