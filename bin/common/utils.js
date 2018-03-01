const { Utils } = require('../..')
const { resolve } = require('path')
const { existsSync } = require('fs')

const getRootDir = argv => resolve(argv._[0] || '.')
const getNuxtConfigFile = argv => resolve(getRootDir(argv), argv['config-file'])

exports.nuxtConfigFile = getNuxtConfigFile

exports.loadNuxtConfig = argv => {
  const rootDir = getRootDir(argv)
  const nuxtConfigFile = getNuxtConfigFile(argv)

  let options = {}

  if (existsSync(nuxtConfigFile)) {
    delete require.cache[nuxtConfigFile]
    options = require(nuxtConfigFile)
  } else if (argv['config-file'] !== 'nuxt.config.js') {
    Utils.fatalError('Could not load config file: ' + argv['config-file'])
  }

  if (typeof options.rootDir !== 'string') {
    options.rootDir = rootDir
  }

  // Nuxt Mode
  options.mode =
    (argv['spa'] && 'spa') || (argv['universal'] && 'universal') || options.mode

  return options
}

exports.getLatestHost = argv => {
  const port =
    argv.port || process.env.PORT || process.env.npm_package_config_nuxt_port
  const host =
    argv.hostname ||
    process.env.HOST ||
    process.env.npm_package_config_nuxt_host

  return { port, host }
}
