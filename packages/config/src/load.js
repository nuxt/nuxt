import path from 'path'
import fs from 'fs'
import defu from 'defu'
import consola from 'consola'
import dotenv from 'dotenv'
import { clearRequireCache, scanRequireTree } from '@nuxt/utils'
import esm from 'esm'
import { defaultNuxtConfigFile } from './config'

export async function loadNuxtConfig ({
  rootDir = '.',
  configFile = defaultNuxtConfigFile,
  configContext = {},
  configOverrides = {}
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

  // Load env
  const env = loadEnv(rootDir)

  // Fill process.env so it is accessible in nuxt.config
  for (const key in env) {
    if (!key.startsWith('_') && process.env[key] === undefined) {
      process.env[key] = env[key]
    }
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
    options = defu(configOverrides, options)

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

  // Load env to options._env
  options._env = env

  // Expand and interpolate runtimeConfig from _env
  for (const c of ['publicRuntimeConfig', 'privateRuntimeConfig']) {
    if (options[c]) {
      expand(options[c], options._env)
    }
  }

  return options
}

function loadEnv (rootDir) {
  const env = Object.create(null)

  // Read dotenv
  const dotenvFile = path.resolve(rootDir, '.env')

  if (fs.existsSync(dotenvFile)) {
    const parsed = dotenv.parse(fs.readFileSync(dotenvFile, 'utf-8'))
    Object.assign(env, parsed)
  }

  // Apply process.env
  Object.assign(env, process.env)

  // Interpolate env
  expand(env)

  return env
}

// Based on https://github.com/motdotla/dotenv-expand
function expand (target, source = {}) {
  function getValue (key) {
    // Source value 'wins' over target value
    return source[key] !== undefined ? source[key] : (target[key] || '')
  }

  function interpolate (value) {
    const matches = value.match(/(.?\${?(?:[a-zA-Z0-9_:]+)?}?)/g) || []
    return matches.reduce((newValue, match) => {
      const parts = /(.?)\${?([a-zA-Z0-9_:]+)?}?/g.exec(match)
      const prefix = parts[1]

      let value, replacePart

      if (prefix === '\\') {
        replacePart = parts[0]
        value = replacePart.replace('\\$', '$')
      } else {
        const key = parts[2]
        replacePart = parts[0].substring(prefix.length)

        value = getValue(key)

        // Resolve recursive interpolations
        value = interpolate(value)
      }

      return newValue.replace(replacePart, value)
    }, value)
  }

  for (const key in target) {
    target[key] = interpolate(getValue(key))
  }
}
