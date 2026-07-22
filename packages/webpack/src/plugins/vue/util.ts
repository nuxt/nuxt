/**
 * This file is based on Vue.js (MIT) webpack plugins
 * https://github.com/vuejs/vue/blob/dev/src/server/webpack-plugin/util.js
 */

import { bundlerDiagnostics, configDiagnostics } from '@nuxt/kit'
import type { Compiler } from 'webpack'

export const validate = (compiler: Compiler) => {
  if (compiler.options.target !== 'node') {
    configDiagnostics.NUXT_B5007()
  }

  if (!compiler.options.externals) {
    bundlerDiagnostics.NUXT_B7019()
  }
}

const isJSRegExp = /\.[cm]?js(\?[^.]+)?$/

export const isJS = (file: string) => isJSRegExp.test(file)

export const extractQueryPartJS = (file: string) => isJSRegExp.exec(file)?.[1]

const isCSSRegExp = /\.css(?:\?[^.]+)?$/

export const isCSS = (file: string) => isCSSRegExp.test(file)

export const isHotUpdate = (file: string) => file.includes('hot-update')
