'use strict'

import { defaults } from 'lodash'

export default function ({ isClient }) {
  let babelOptions = JSON.stringify(defaults(this.options.build.babel, {
    presets: ['vue-app'],
    cacheDirectory: !!this.dev
  }))
  let config = {
    postcss: this.options.build.postcss,
    loaders: {
      'js': 'babel-loader?' + babelOptions,
      'less': 'vue-style-loader!css-loader!less-loader',
      'sass': 'vue-style-loader!css-loader!sass-loader?indentedSyntax',
      'scss': 'vue-style-loader!css-loader!sass-loader',
      'stylus': 'vue-style-loader!css-loader!stylus-loader',
      'styl': 'vue-style-loader!css-loader!stylus-loader'
    },
    preserveWhitespace: false
  }

  if (!this.dev && isClient) {
    // Use ExtractTextPlugin to extract CSS into a single file
    const ExtractTextPlugin = require('extract-text-webpack-plugin')
    config.loaders.css = ExtractTextPlugin.extract({ loader: 'css-loader' })
    config.loaders.scss = ExtractTextPlugin.extract({ loader: 'css-loader!sass-loader', fallbackLoader: 'vue-style-loader' })
    config.loaders.sass = ExtractTextPlugin.extract({ loader: 'css-loader!sass-loader?indentedSyntax', fallbackLoader: 'vue-style-loader' })
    config.loaders.stylus = ExtractTextPlugin.extract({ loader: 'css-loader!stylus-loader', fallbackLoader: 'vue-style-loader' })
    config.loaders.less = ExtractTextPlugin.extract({ loader: 'css-loader!less-loader', fallbackLoader: 'vue-style-loader' })
  }

  // Return the config
  return config
}
