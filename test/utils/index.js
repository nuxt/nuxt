const path = require('path')
const fs = require('fs')

const _getPort = require('get-port')
const { defaultsDeep } = require('lodash')
const _rp = require('request-promise-native')
const { requireModule } = require('../../lib/common/module')
const pkg = require('../../package.json')
const Dist = require('../../dist/nuxt-test')

exports.rp = _rp
exports.getPort = _getPort
exports.version = pkg.version

exports.Nuxt = Dist.Nuxt
exports.Utils = Dist.Utils
exports.Options = Dist.Options
exports.Builder = Dist.Builder
exports.Generator = Dist.Generator

exports.loadFixture = function loadFixture(fixture, overrides) {
  const rootDir = path.resolve(__dirname, '../fixtures/' + fixture)
  const configFile = path.resolve(rootDir, 'nuxt.config.js')

  const config = fs.existsSync(configFile) ? requireModule(configFile) : {}

  config.rootDir = rootDir
  config.dev = false

  return defaultsDeep({}, overrides, config)
}
