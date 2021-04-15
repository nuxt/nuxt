import { resolve } from 'path'
import defu from 'defu'
import { applyDefaults } from 'untyped'
import * as rc from 'rc9'
import { tryResolveModule, requireModule, scanRequireTree } from '../utils/cjs'
import { NuxtOptions } from '../types/config'
import nuxtConfigSchema from './schema'

export interface LoadNuxtConfigOptions {
  /** Your project root directory (either absolute or relative to the current working directory). */
  rootDir?: string
  /** The path to your `nuxt.config` file (either absolute or relative to your project `rootDir`). */
  configFile?: string
  /** Any overrides to your Nuxt configuration. */
  config?: Record<string, any>
}

export function loadNuxtConfig (opts: LoadNuxtConfigOptions): NuxtOptions {
  const rootDir = resolve(process.cwd(), opts.rootDir || '.')

  const nuxtConfigFile = tryResolveModule(resolve(rootDir, opts.configFile || 'nuxt.config'))

  let nuxtConfig: any = {}

  if (nuxtConfigFile) {
    nuxtConfig = requireModule(nuxtConfigFile, { clearCache: true })
    nuxtConfig = { ...nuxtConfig }
    nuxtConfig._nuxtConfigFile = nuxtConfigFile
    nuxtConfig._nuxtConfigFiles = Array.from(scanRequireTree(nuxtConfigFile))
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
