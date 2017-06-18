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
/* istanbul ignore else */
process.noDeprecation = true

// Require Core
const Core = require('./dist/core.js')
Object.assign(exports, Core)

// Require Builder
const Builder = require('./dist/builder.js')
Object.assign(exports, Builder)
