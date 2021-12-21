// CommonJS proxy to bypass jiti transforms from nuxt 2
module.exports = function (...args) {
  return import('./dist/module.mjs').then(m => m.default.call(this, ...args))
}

const pkg = require('./package.json')

module.exports.defineNuxtConfig = (config = {}) => {
  if (config.bridge !== false) {
    config.bridge = config.bridge || {}
    config.bridge._version = pkg.version
    if (!config.buildModules) {
      config.buildModules = []
    }
    if (!config.buildModules.find(m => m === '@nuxt/bridge' || m === '@nuxt/bridge-edge')) {
      config.buildModules.unshift('@nuxt/bridge')
    }
  }
  return config
}

module.exports.meta = {
  pkg,
  name: pkg.name,
  version: pkg.version
}
