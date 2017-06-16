import ExtractTextPlugin from 'extract-text-webpack-plugin'

export function extractStyles () {
  return !this.options.dev && this.options.build.extractCSS
}

export function styleLoader (ext, loader = []) {
  if (extractStyles.call(this)) {
    return ExtractTextPlugin.extract({
      use: ['css-loader?minify&sourceMap'].concat(loader),
      fallback: 'vue-style-loader?sourceMap'
    })
  }
  return ['vue-style-loader?sourceMap', 'css-loader?sourceMap'].concat(loader)
}
