module.exports = {
  build: {
    filenames: {
      css: 'app.css', // default: style.css
      vendor: 'vendor.js', // default: vendor.bundle.js
      app: 'app.js' // default: nuxt.bundle.js
    },
    vendor: ['lodash'],
    // Loaders config (Webpack 2)
    loaders: [
      {
        test: /\.(png|jpg|gif|svg)$/,
        loader: 'url',
        options: {
          limit: 100000, // 100KO
          name: 'img/[name].[ext]?[hash]'
        }
      }
    ]
  }
}
