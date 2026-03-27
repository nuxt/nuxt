/**
 * This file is based on Vue.js (MIT) webpack plugins
 * https://github.com/vuejs/vue/blob/dev/src/server/webpack-plugin/util.js
 */

import { ErrorCodes, buildErrorUtils, logger } from '@nuxt/kit'
import type { Compiler } from 'webpack'

export const validate = (compiler: Compiler) => {
  if (compiler.options.target !== 'node') {
    buildErrorUtils.warn('webpack config `target` should be "node".', { code: ErrorCodes.B5007, fix: 'Set `target: "node"` in your webpack server configuration.' })
  }

  if (!compiler.options.externals) {
    logger.info(
      'It is recommended to externalize dependencies in the server build for better build performance.',
    )
  }
}

const isJSRegExp = /\.[cm]?js(\?[^.]+)?$/

export const isJS = (file: string) => isJSRegExp.test(file)

export const extractQueryPartJS = (file: string) => isJSRegExp.exec(file)?.[1]

const isCSSRegExp = /\.css(?:\?[^.]+)?$/

export const isCSS = (file: string) => isCSSRegExp.test(file)

export const isHotUpdate = (file: string) => file.includes('hot-update')
