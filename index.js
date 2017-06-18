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
// TODO: conditionally do this when builder available
const Builder = require('./dist/builder.js')
Object.assign(exports, Builder.default || Builder)

module.exports = Object.assign(Core, Builder)
