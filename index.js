/*!
 * Nuxt.js
 * (c) 2016-2017 Chopin Brothers
 * Released under the MIT License.
 */

const path = require('path')

process.noDeprecation = true

// Node Source Map Support
// https://github.com/evanw/node-source-map-support
require('source-map-support').install();

const Core = require('./dist/core.js')

// ------------------------------------------------------------------
// Polyfill Builder into Core
const Builder = require('./dist/builder')
// Use special env flag to specify app dir without modify builder
if (!process.env.NUXT_APP_TEMPALTE_DIR) {
  process.env.NUXT_APP_TEMPALTE_DIR = path.resolve(__dirname, 'app')
}
Object.assign(Core, Builder)
// ------------------------------------------------------------------

module.exports = Core.default ? Core.default : Core
