import path from 'path'
import consola from 'consola'
import { clearRequireCache, scanRequireTree } from '@nuxt/utils'
import esm from 'esm'
import { defaultNuxtConfigFile } from './config'

export async function loadNuxtConfig ({
  rootDir = '.',
  configFile = defaultNuxtConfigFile,
  configContext = {}
} = {}) {
  rootDir = path.resolve(rootDir)

  let options = {}

  try {
    configFile = require.resolve(path.resolve(rootDir, configFile))
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw (e)
    } else if (configFile !== defaultNuxtConfigFile) {
      consola.fatal('Config file not found: ' + configFile)
    }
    // Skip configFile if cannot resolve
    configFile = undefined
  }

  if (configFile) {
    // Clear cache
    clearRequireCache(configFile)

    options = esm(module)(configFile) || {}

    if (options.default) {
      options = options.default
    }

    if (typeof options === 'function') {
      try {
        options = await options(configContext)
        if (options.default) {
          options = options.default
        }
      } catch (error) {
        consola.error(error)
        consola.fatal('Error while fetching async configuration')
      }
    }

    // Don't mutate options export
    options = Object.assign({}, options)

    // Keep _nuxtConfigFile for watching
    options._nuxtConfigFile = configFile

    // Keep all related files for watching
    options._nuxtConfigFiles = Array.from(scanRequireTree(configFile))
    if (!options._nuxtConfigFiles.includes(configFile)) {
      options._nuxtConfigFiles.unshift(configFile)
    }
  }

  if (typeof options.rootDir !== 'string') {
    options.rootDir = rootDir
  }

  return options
}
