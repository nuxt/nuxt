/*!
 * Nuxt.js
 * (c) 2016-2018 Chopin Brothers
 * Core maintainers: Pooya Parsa (@pi0) - Clark Du (@clarkdo)
 * Released under the MIT License.
 */

import core from './core'
import builder from './builder'
import * as Utils from './common/utils'
import Options from './common/options'

export default {
  Utils,
  Options,
  ...core,
  ...builder
}
