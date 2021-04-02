import { resolve } from 'path'
import defu from 'defu'
import jiti from 'jiti'
import { applyDefaults } from 'untyped'
import * as rc from 'rc9'
import { NuxtOptions } from '../types/config'
import nuxtConfigSchema from './schema'

export interface LoadNuxtConfigOptions {
  rootDir?: string
  configFile?: string
  config?: any
}

export function loadNuxtConfig (opts: LoadNuxtConfigOptions): NuxtOptions {
  const rootDir = resolve(process.cwd(), opts.rootDir || '.')

  const _require = jiti(rootDir)

  let configFile
  try {
    configFile = _require.resolve(resolve(rootDir, opts.configFile || 'nuxt.config'))
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw (e)
    }
    // Skip if cannot resolve
    configFile = undefined
  }

  let nuxtConfig: any = {}

  if (configFile) {
    // clearRequireCache(configFile) TODO
    nuxtConfig = _require(configFile) || {}
    if (nuxtConfig.default) {
      nuxtConfig = nuxtConfig.default
    }
    nuxtConfig = { ...nuxtConfig }
  }

  // Combine configs
  // Priority: configOverrides > nuxtConfig > .nuxtrc > .nuxtrc (global)
  nuxtConfig = defu(
    opts.config,
    nuxtConfig,
    rc.read({ name: '.nuxtrc', dir: rootDir }),
    rc.readUser('.nuxtrc')
  )

  // Set rootDir
  if (!nuxtConfig.rootDir) {
    nuxtConfig.rootDir = rootDir
  }

  // Resolve and apply defaults
  return applyDefaults(nuxtConfigSchema, nuxtConfig) as NuxtOptions
}
