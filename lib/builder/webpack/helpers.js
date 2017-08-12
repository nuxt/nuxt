import ExtractTextPlugin from 'extract-text-webpack-plugin'
import { join } from 'path'

export function extractStyles () {
  return !this.options.dev && this.options.build.extractCSS
}

export function styleLoader (ext, loaders = []) {
  // https://github.com/webpack-contrib/css-loader
  const cssLoader = {
    loader: 'css-loader',
    options: {
      minimize: true,
      sourceMap: true,
      // https://github.com/webpack/loader-utils#root-relative-urls
      root: '~',
      alias: {
        '/static': join(this.options.srcDir, 'static'),
        '/assets': join(this.options.srcDir, 'assets')
      }
    }
  }

  // https://github.com/vuejs/vue-style-loader
  const vueStyleLoader = {
    loader: 'vue-style-loader',
    options: {
      sourceMap: true
    }
  }

  if (extractStyles.call(this)) {
    return ExtractTextPlugin.extract({
      use: [cssLoader].concat(loaders),
      fallback: vueStyleLoader
    })
  }

  return [vueStyleLoader, cssLoader].concat(loaders)
}
