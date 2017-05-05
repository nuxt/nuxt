import ExtractTextPlugin from 'extract-text-webpack-plugin'

export function extractStyles (ext) {
  return !this.dev && !!this.options.build.extractCSS && this.options.build.extractCSS[ext] !== false
}

export function styleLoader (ext, loader = []) {
  if (!extractStyles.call(this, ext)) {
    return ['vue-style-loader', 'css-loader'].concat(loader)
  }
  return ExtractTextPlugin.extract({
    use: ['css-loader?minimize'].concat(loader),
    fallback: 'vue-style-loader'
  })
}
