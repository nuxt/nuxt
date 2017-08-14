import ExtractTextPlugin from 'extract-text-webpack-plugin'
import { join } from 'path'

export default function styleLoader (ext, loaders = [], isVueLoader = false) {
  // Normalize loaders
  loaders = (Array.isArray(loaders) ? loaders : [loaders]).map(loader => {
    if (typeof loader === 'string') {
      return {
        loader,
        options: {
          // Source map is REQUIRED for urlLoader
          sourceMap: true
        }
      }
    }
    return loader
  })

  // https://github.com/postcss/postcss-loader
  let postcssLoader
  let postcssPlugins = this.options.build.postcss
  if (!isVueLoader && Array.isArray(postcssPlugins) && postcssPlugins.length) {
    postcssLoader = {
      loader: 'postcss-loader',
      options: {
        sourceMap: this.options.build.cssSourceMap,
        plugins: () => postcssPlugins,
        config: {}
      }
    }
  }

  // https://github.com/webpack-contrib/css-loader
  const cssLoader = {
    loader: 'css-loader',
    options: {
      minimize: true,
      importLoaders: 1,
      sourceMap: this.options.build.cssSourceMap,
      root: '~', // https://github.com/webpack/loader-utils#root-relative-urls
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
      sourceMap: this.options.build.cssSourceMap
    }
  }

  // https://github.com/bholloway/resolve-url-loader
  const urlLoader = {
    loader: 'resolve-url-loader'
  }

  if (this.options.build.extractCSS) {
    return ExtractTextPlugin.extract({
      fallback: vueStyleLoader,
      use: [
        cssLoader,
        postcssLoader,
        urlLoader,
        ...loaders
      ].filter(l => l)
    })
  }

  return [
    vueStyleLoader,
    cssLoader,
    postcssLoader,
    urlLoader,
    ...loaders
  ].filter(l => l)
}
