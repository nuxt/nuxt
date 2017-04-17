'use strict'

import { defaults } from 'lodash'

export default function ({ isClient }) {
  let babelOptions = JSON.stringify(defaults(this.options.build.babel, {
    presets: ['vue-app'],
    babelrc: false,
    cacheDirectory: !!this.dev
  }))
  let config = {
    postcss: this.options.build.postcss,
    loaders: {
      'js': 'babel-loader?' + babelOptions,
      'css': 'vue-style-loader!css-loader',
      'less': 'vue-style-loader!css-loader!less-loader',
      'sass': 'vue-style-loader!css-loader!sass-loader?indentedSyntax',
      'scss': 'vue-style-loader!css-loader!sass-loader',
      'stylus': 'vue-style-loader!css-loader!stylus-loader',
      'styl': 'vue-style-loader!css-loader!stylus-loader'
    },
    preserveWhitespace: false
  }
  // Return the config
  return config
}
