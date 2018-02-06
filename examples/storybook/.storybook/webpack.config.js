const webpack = require('webpack')
const path = require('path')
const nxtConf = require('../nuxt.config')

module.exports = (sBaseConfig, configType, defaultConfig) => {

    const srcDir = `../${nxtConf.srcDir||''}`
    const rootDir = `../${nxtConf.rootDir||''}`
    Object.assign(defaultConfig.resolve.alias, {
        '~~': path.resolve(__dirname, rootDir),
        '~': path.resolve(__dirname, srcDir)
    })

    return defaultConfig
}