
// Until babel-loader 7 is released
process.noDeprecation = true

var nodeExternals = require('webpack-node-externals')
var ProgressBarPlugin = require('progress-bar-webpack-plugin')
var CopyWebpackPlugin = require('copy-webpack-plugin')
var resolve = require('path').resolve
var r = function (p) { return resolve(__dirname, p) }

module.exports = {
  target: 'node',
  node: {
    __dirname: false,
    __filename: false
  },
  devtool: 'source-map',
  entry: r('./lib/nuxt.js'),
  output: {
    path: r('./dist'),
    filename: 'nuxt.js',
    libraryTarget: 'commonjs2'
  },
  externals: [
    nodeExternals()
  ],
  module: {
    rules: [
      {
        test: /\.json$/,
        loader: 'json-loader'
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          plugins: [
            'transform-async-to-generator',
            'array-includes',
            'transform-runtime'
          ],
          presets: [
            ['es2015', { modules: false }],
            'stage-2'
          ],
          cacheDirectory: true
        }
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: 'lib/app', to: 'app' },
      { from: 'lib/views', to: 'views' }
    ]),
    new ProgressBarPlugin()
  ]
}
