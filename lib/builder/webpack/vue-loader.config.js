import { defaults } from 'lodash'
import { extractStyles, styleLoader } from './helpers'

export default function ({ isClient }) {
  let babelOptions = JSON.stringify(defaults(this.options.build.babel, {
    presets: [require.resolve('babel-preset-vue-app')],
    babelrc: false,
    cacheDirectory: !!this.options.dev
  }))

  // https://github.com/vuejs/vue-loader/blob/master/docs/en/configurations
  const config = {
    postcss: this.options.build.postcss,
    loaders: {
      'js': 'babel-loader?' + babelOptions,
      'css': styleLoader.call(this, 'css'),
      'less': styleLoader.call(this, 'less', 'less-loader'),
      'sass': styleLoader.call(this, 'sass', 'sass-loader?indentedSyntax&sourceMap'),
      'scss': styleLoader.call(this, 'sass', 'sass-loader?sourceMap'),
      'stylus': styleLoader.call(this, 'stylus', 'stylus-loader'),
      'styl': styleLoader.call(this, 'stylus', 'stylus-loader')
    },
    preserveWhitespace: false,
    extractCSS: extractStyles.call(this)
  }

  // Return the config
  return config
}
