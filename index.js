/*!
 * Nuxt.js
 * (c) 2016-2017 Chopin Brothers
 * Released under the MIT License.
 */

process.noDeprecation = true

var Nuxt = require('./dist/nuxt.js')

module.exports = Nuxt.default ? Nuxt.default : Nuxt
