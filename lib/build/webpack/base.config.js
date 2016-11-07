const vueLoaderConfig = require('./vue-loader.config')

/*
|--------------------------------------------------------------------------
| Webpack Shared Config
|
| This is the config which is extented by the server and client
| webpack config files
|--------------------------------------------------------------------------
*/
module.exports = {
  devtool: 'source-map',
  entry: {
    vendor: ['vue', 'vue-router', 'vue-meta', 'es6-promise', 'es6-object-assign']
  },
  output: {
    publicPath: '/_nuxt/'
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue',
        options: vueLoaderConfig
      },
      {
        test: /\.js$/,
        loader: 'babel',
        exclude: /node_modules/,
        options: {
          presets: ['es2015', 'stage-2']
        }
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        loader: 'url',
        options: {
          limit: 1000, // 1KO
          name: 'img/[name].[ext]?[hash]'
        }
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        loader: 'url',
        query: {
          limit: 1000, // 1 KO
          name: 'fonts/[name].[hash:7].[ext]'
        }
      }
    ]
  }
}
