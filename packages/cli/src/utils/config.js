import path from 'path'
import consola from 'consola'
import defaultsDeep from 'lodash/defaultsDeep'
import { defaultNuxtConfigFile, getDefaultNuxtConfig } from '@nuxt/config'
import { clearRequireCache, scanRequireTree } from '@nuxt/utils'
import esm from 'esm'

export async function loadNuxtConfig(argv) {
  // 인자로 받은 파일의 절대 경로를 리턴, 이 경우는 process.argv.slice(2)나 현재 파일의 절대 경로
  const rootDir = path.resolve(argv._[0] || '.')
  let nuxtConfigFile
  let options = {}
 
  try {
    // require resolve 경로에서 파일만 가져옴
    nuxtConfigFile = require.resolve(path.resolve(rootDir, argv['config-file']))
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw (e)
      // 'config-file'이 없으면, @nuxt/config에서 defaultNuxtConfigFile 가져옴
    } else if (argv['config-file'] !== defaultNuxtConfigFile) {
      consola.fatal('Could not load config file: ' + argv['config-file'])
    }
  }

  // 20190429 여기서 부터

  if (nuxtConfigFile) {
    // Clear cache
    clearRequireCache(nuxtConfigFile)

    if (nuxtConfigFile.endsWith('.ts')) {
      options = require(nuxtConfigFile) || {}
    } else {
      options = esm(module)(nuxtConfigFile) || {}
    }

    if (options.default) {
      options = options.default
    }

    if (typeof options === 'function') {
      try {
        options = await options()
        if (options.default) {
          options = options.default
        }
      } catch (error) {
        consola.error(error)
        consola.fatal('Error while fetching async configuration')
      }
    }

    // Keep _nuxtConfigFile for watching
    options._nuxtConfigFile = nuxtConfigFile

    // Keep all related files for watching
    options._nuxtConfigFiles = Array.from(scanRequireTree(nuxtConfigFile))
    if (!options._nuxtConfigFiles.includes(nuxtConfigFile)) {
      options._nuxtConfigFiles.unshift(nuxtConfigFile)
    }
  }

  if (typeof options.rootDir !== 'string') {
    options.rootDir = rootDir
  }

  // Nuxt Mode
  options.mode =
    (argv.spa && 'spa') || (argv.universal && 'universal') || options.mode

  // Server options
  options.server = defaultsDeep({
    port: argv.port || undefined,
    host: argv.hostname || undefined,
    socket: argv['unix-socket'] || undefined
  }, options.server || {}, getDefaultNuxtConfig().server)

  return options
}
