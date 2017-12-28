module.exports = function vueLoader({ isServer }) {
  // https://vue-loader.vuejs.org/en
  const config = {
    postcss: this.options.build.postcss,
    extractCSS: !!this.options.build.extractCSS,
    cssSourceMap: this.options.build.cssSourceMap,
    preserveWhitespace: false,
    loaders: {
      'js': {
        loader: 'babel-loader',
        options: this.getBabelOptions({ isServer })
      },
      // Note: do not nest the `postcss` option under `loaders`
      'css': this.styleLoader('css', [], true),
      'less': this.styleLoader('less', 'less-loader', true),
      'scss': this.styleLoader('scss', 'sass-loader', true),
      'sass': this.styleLoader('sass', {loader: 'sass-loader', options: { indentedSyntax: true }}, true),
      'stylus': this.styleLoader('stylus', 'stylus-loader', true),
      'styl': this.styleLoader('stylus', 'stylus-loader', true)
    },
    template: {
      doctype: 'html' // For pug, see https://github.com/vuejs/vue-loader/issues/55
    },
    transformToRequire: {
      video: 'src',
      source: 'src',
      object: 'src',
      embed: 'src'
    }
  }

  // Return the config
  return config
}
