/*!
 * Nuxt.js
 * (c) 2016-2017 Chopin Brothers
 * Core maintainer: Pooya (@pi0)
 * Released under the MIT License.
 */

// Node Source Map Support
// https://github.com/evanw/node-source-map-support
require('source-map-support').install();

// Fix babel flag
process.noDeprecation = true

// Require Core
const Core = require('./dist/core.js')
Object.assign(exports, Core.default || Core)

// Require Builder
const Builder = require('./dist/builder')
Object.assign(exports, Builder.default || Builder)

// Use special env flag to specify app dir without modify builder
if (!process.env.NUXT_APP_DIR) {
  process.env.NUXT_APP_DIR = path.resolve(__dirname, 'lib/app')
}

module.exports = Object.assign(Core, Builder)
