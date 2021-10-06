// CommonJS proxy to bypass jiti transforms from nuxt 2
module.exports = function (...args) {
  return import('./dist/module.mjs').then(m => m.default.call(this, ...args))
}

module.exports.defineNuxtConfig = (config = {}) => {
  if (config.bridge !== false) {
    if (!config.buildModules) {
      config.buildModules = []
    }
    if (!config.buildModules.find(m => m === '@nuxt/bridge')) {
      config.buildModules.push('@nuxt/bridge')
    }
  }
  return config
}
