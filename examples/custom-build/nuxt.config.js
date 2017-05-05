module.exports = {
  build: {
    filenames: {
        css: 'styles.[chunkhash].css',    // default: common.[chunkhash].css
        manifest: 'manifest.[hash].js',   // default: manifest.[hash].js
        vendor: 'vendor.[hash].js',       // default: vendor.bundle.[hash].js
        app: 'app.[chunkhash].js'         // default: nuxt.bundle.[chunkhash].js
    },
    vendor: ['lodash'],
    // Loaders config (Webpack 2)
    loaders: [
      {
        test: /\.(png|jpg|gif|svg)$/,
        loader: 'url-loader',
        options: {
          limit: 100000, // 100KO
          name: 'img/[name].[ext]?[hash]'
        }
      }
    ],
    extend (config, { dev }) {
      if (dev) {
        config.devtool = (dev ? 'eval-source-map' : false)
      }
    }
  }
}
