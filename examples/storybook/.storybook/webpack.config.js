const path = require('path')
const nuxtConf = require('../nuxt.config')

module.exports = (sBaseConfig, configType, defaultConfig) => {
  const srcDir = `../${nuxtConf.srcDir || ''}`
  const rootDir = `../${nuxtConf.rootDir || ''}`

  Object.assign(defaultConfig.resolve.alias, {
    '~~': path.resolve(__dirname, rootDir),
    '~': path.resolve(__dirname, srcDir)
  })

  return defaultConfig
}
