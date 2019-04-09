import path from 'path'
import consola from 'consola'
import defaultsDeep from 'lodash/defaultsDeep'
import { defaultNuxtConfigFile, getDefaultNuxtConfig } from '@nuxt/config'
import esm from 'esm'

export async function loadNuxtConfig(argv) {
  const rootDir = path.resolve(argv._[0] || '.')
  let nuxtConfigFile
  let options = {}

  try {
    nuxtConfigFile = require.resolve(path.resolve(rootDir, argv['config-file']))
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw (e)
    } else if (argv['config-file'] !== defaultNuxtConfigFile) {
      consola.fatal('Could not load config file: ' + argv['config-file'])
    }
  }

  if (nuxtConfigFile) {
    if (nuxtConfigFile.endsWith('.ts')) {
      options = require(nuxtConfigFile) || {}
    } else {
      clearRequireCache(nuxtConfigFile)
      options = esm(module, { cache: false, cjs: { cache: false } })(nuxtConfigFile) || {}
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

function clearRequireCache(id) {
  const entry = require.cache[id]
  if (!entry || /node_modules/.test(id)) {
    return
  }

  for (const child of entry.children) {
    clearRequireCache(child.id)
  }

  delete require.cache[id]
}

function scanRequireTree(id, files = new Set()) {
  const entry = require.cache[id]
  if (!entry || /node_modules/.test(id) || files.has(id)) {
    return files
  }

  files.add(entry.id)

  for (const child of entry.children) {
    scanRequireTree(child.id, files)
  }

  return files
}
