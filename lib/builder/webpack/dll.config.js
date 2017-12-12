const webpack = require('webpack')
const { resolve } = require('path')
const ClientConfig = require('./client.config')

/*
|--------------------------------------------------------------------------
| Webpack Dll Config
| https://github.com/webpack/webpack/tree/master/examples/dll
|--------------------------------------------------------------------------
*/
module.exports = function webpackDllConfig(_refConfig) {
  const refConfig = _refConfig || new ClientConfig()

  const name = refConfig.name + '-dll'
  const dllDir = resolve(this.options.cacheDir, name)

  let config = {
    name,
    entry: this.vendorEntries(),
    // context: this.options.rootDir,
    resolve: refConfig.resolve,
    target: refConfig.target,
    resolveLoader: refConfig.resolveLoader,
    module: refConfig.module,
    plugins: []
  }

  config.output = {
    path: dllDir,
    filename: '[name]_[hash].js',
    library: '[name]_[hash]'
  }

  config.plugins.push(
    new webpack.DllPlugin({
      // The path to the manifest file which maps between
      // modules included in a bundle and the internal IDs
      // within that bundle
      path: resolve(dllDir, '[name]-manifest.json'),

      name: '[name]_[hash]'
    })
  )

  return config
}
