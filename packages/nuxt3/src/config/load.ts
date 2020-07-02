import path from 'path'
import fs from 'fs'
import defu from 'defu'
import consola from 'consola'
import dotenv from 'dotenv'
import { clearRequireCache, scanRequireTree } from 'src/utils'
import jiti from 'jiti'
import _createRequire from 'create-require'
import destr from 'destr'
import * as rc from 'rc9'
import { defaultNuxtConfigFile } from './config'

const isJest = typeof jest !== 'undefined'

export async function loadNuxtConfig ({
  rootDir = '.',
  envConfig = {},
  configFile = defaultNuxtConfigFile,
  configContext = {},
  configOverrides = {},
  createRequire = module => isJest ? _createRequire(module.filename) : jiti(module.filename)
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
  envConfig = {
    dotenv: '.env',
    env: process.env,
    expand: true,
    ...envConfig
  }

  const env = loadEnv(envConfig, rootDir)

  // Fill process.env so it is accessible in nuxt.config
  for (const key in env) {
    if (!key.startsWith('_') && envConfig.env[key] === undefined) {
      envConfig.env[key] = env[key]
    }
  }

  if (configFile) {
    // Clear cache
    clearRequireCache(configFile)
    const _require = createRequire(module)
    options = _require(configFile) || {}
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
    options = { ...options }

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

  // Load Combine configs
  // Priority: configOverrides > nuxtConfig > .nuxtrc > .nuxtrc (global)
  options = defu(
    configOverrides,
    options,
    rc.read({ name: '.nuxtrc', dir: options.rootDir }),
    rc.readUser('.nuxtrc')
  )

  // Load env to options._env
  options._env = env
  options._envConfig = envConfig
  if (configContext) { configContext.env = env }

  // Expand and interpolate runtimeConfig from _env
  if (envConfig.expand) {
    for (const c of ['publicRuntimeConfig', 'privateRuntimeConfig']) {
      if (options[c]) {
        if (typeof options[c] === 'function') {
          options[c] = options[c](env)
        }
        expand(options[c], env, destr)
      }
    }
  }

  return options
}

function loadEnv (envConfig, rootDir = process.cwd()) {
  const env = Object.create(null)

  // Read dotenv
  if (envConfig.dotenv) {
    envConfig.dotenv = path.resolve(rootDir, envConfig.dotenv)
    if (fs.existsSync(envConfig.dotenv)) {
      const parsed = dotenv.parse(fs.readFileSync(envConfig.dotenv, 'utf-8'))
      Object.assign(env, parsed)
    }
  }

  // Apply process.env
  if (!envConfig.env._applied) {
    Object.assign(env, envConfig.env)
    envConfig.env._applied = true
  }

  // Interpolate env
  if (envConfig.expand) {
    expand(env)
  }

  return env
}

// Based on https://github.com/motdotla/dotenv-expand
function expand (target, source = {}, parse = v => v) {
  function getValue (key) {
    // Source value 'wins' over target value
    return source[key] !== undefined ? source[key] : target[key]
  }

  function interpolate (value) {
    if (typeof value !== 'string') {
      return value
    }
    const matches = value.match(/(.?\${?(?:[a-zA-Z0-9_:]+)?}?)/g) || []
    return parse(matches.reduce((newValue, match) => {
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
    }, value))
  }

  for (const key in target) {
    target[key] = interpolate(getValue(key))
  }
}
