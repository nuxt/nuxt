const path = require('path')
const nuxtConf = require('../nuxt.config')

module.exports = ({ config, mode }) => {
  const srcDir = `../${nuxtConf.srcDir || ''}`
  const rootDir = `../${nuxtConf.rootDir || ''}`

  Object.assign(config.resolve.alias, {
    "~~": path.resolve(__dirname, rootDir),
    "~": path.resolve(__dirname, srcDir)
  })

  return config
}
