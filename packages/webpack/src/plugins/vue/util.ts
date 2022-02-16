/**
 * This file is based on Vue.js (MIT) webpack plugins
 * https://github.com/vuejs/vue/blob/dev/src/server/webpack-plugin/util.js
 */

import { logger } from '@nuxt/kit'

export const validate = (compiler) => {
  if (compiler.options.target !== 'node') {
    logger.warn('webpack config `target` should be "node".')
  }

  if (!compiler.options.externals) {
    logger.info(
      'It is recommended to externalize dependencies in the server build for ' +
      'better build performance.'
    )
  }
}

const isJSRegExp = /\.[cm]?js(\?[^.]+)?$/

export const isJS = file => isJSRegExp.test(file)

export const extractQueryPartJS = file => isJSRegExp.exec(file)[1]

export const isCSS = file => /\.css(\?[^.]+)?$/.test(file)

export const isHotUpdate = file => file.includes('hot-update')
