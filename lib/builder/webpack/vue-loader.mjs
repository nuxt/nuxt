import postcssConfig from './postcss'
import styleLoaderWrapper from './style-loader'

export default function vueLoader({ isServer }) {
  // https://vue-loader.vuejs.org/en
  const styleLoader = styleLoaderWrapper({
    isServer,
    isVueLoader: true
  })
  const config = {
    postcss: postcssConfig.call(this),
    cssSourceMap: this.options.build.cssSourceMap,
    preserveWhitespace: false,
    loaders: {
      js: {
        loader: 'babel-loader',
        options: this.getBabelOptions({ isServer })
      },
      // Note: do not nest the `postcss` option under `loaders`
      css: styleLoader.call(this, 'css', []),
      less: styleLoader.call(this, 'less', 'less-loader'),
      scss: styleLoader.call(this, 'scss', 'sass-loader'),
      sass: styleLoader.call(
        this,
        'sass',
        { loader: 'sass-loader', options: { indentedSyntax: true } }
      ),
      stylus: styleLoader.call(this, 'stylus', 'stylus-loader'),
      styl: styleLoader.call(this, 'stylus', 'stylus-loader')
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
