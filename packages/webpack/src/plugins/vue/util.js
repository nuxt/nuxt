/**
 * This file is based on Vue.js (MIT) webpack plugins
 * https://github.com/vuejs/vue/blob/dev/src/server/webpack-plugin/util.js
 */

import consola from 'consola'

export const validate = (compiler) => {
  if (compiler.options.target !== 'node') {
    consola.warn('webpack config `target` should be "node".')
  }

  if (compiler.options.output && compiler.options.output.libraryTarget !== 'commonjs2') {
    consola.warn('webpack config `output.libraryTarget` should be "commonjs2".')
  }

  if (!compiler.options.externals) {
    consola.info(
      'It is recommended to externalize dependencies in the server build for ' +
      'better build performance.'
    )
  }
}

export const onEmit = (compiler, name, hook) => {
  if (compiler.hooks) {
    // Webpack >= 4.0.0
    compiler.hooks.emit.tapAsync(name, hook)
  } else {
    // Webpack < 4.0.0
    compiler.plugin('emit', hook)
  }
}

export const isJS = file => /\.js(\?[^.]+)?$/.test(file)

export const isCSS = file => /\.css(\?[^.]+)?$/.test(file)
