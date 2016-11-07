module.exports = {
  postcss: [
    require('autoprefixer')({
      browsers: ['last 3 versions']
    })
  ],
  loaders: {
    'js': 'babel-loader?presets[]=es2015&presets[]=stage-2',
    'postcss': 'vue-style-loader!css-loader',
    'less': 'vue-style-loader!css-loader!less-loader',
    'sass': 'vue-style-loader!css-loader!sass-loader?indentedSyntax',
    'scss': 'vue-style-loader!css-loader!sass-loader',
    'stylus': 'vue-style-loader!css-loader!stylus-loader',
    'styl': 'vue-style-loader!css-loader!stylus-loader'
  }
}
