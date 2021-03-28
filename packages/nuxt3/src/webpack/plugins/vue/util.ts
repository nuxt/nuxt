/**
 * This file is based on Vue.js (MIT) webpack plugins
 * https://github.com/vuejs/vue/blob/dev/src/server/webpack-plugin/util.js
 */

import consola from 'consola'

export const validate = (compiler) => {
  if (compiler.options.target !== 'node') {
    consola.warn('webpack config `target` should be "node".')
  }

  const libraryType = compiler.options.output.library.type
  if (libraryType !== 'commonjs2') {
    consola.warn('webpack config `output.libraryTarget` should be "commonjs2".')
  }

  if (!compiler.options.externals) {
    consola.info(
      'It is recommended to externalize dependencies in the server build for ' +
      'better build performance.'
    )
  }
}

const isJSRegExp = /\.js(\?[^.]+)?$/

export const isJS = file => isJSRegExp.test(file)

export const extractQueryPartJS = file => isJSRegExp.exec(file)[1]

export const isCSS = file => /\.css(\?[^.]+)?$/.test(file)

export const isHotUpdate = file => file.includes('hot-update')
