/*!
 * Nuxt.js
 * (c) 2016-2017 Chopin Brothers
 * Core maintainer: Pooya (@pi0)
 * Released under the MIT License.
 */

// Node Source Map Support
// https://github.com/evanw/node-source-map-support
require('source-map-support').install()

// Fix babel flag
/* istanbul ignore else */
process.noDeprecation = true

module.exports = require('./dist/nuxt')
