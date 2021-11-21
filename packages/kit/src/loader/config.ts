import { existsSync } from 'fs'
import { resolve } from 'pathe'
import defu from 'defu'
import { applyDefaults } from 'untyped'
import * as rc from 'rc9'
import type { NuxtOptions } from '@nuxt/schema'
import { NuxtConfigSchema } from '@nuxt/schema'
import { tryResolveModule, requireModule, scanRequireTree } from '../internal/cjs'
import { setupDotenv, DotenvOptions } from '../internal/dotenv'

export interface LoadNuxtConfigOptions {
  /** Your project root directory (either absolute or relative to the current working directory). */
  rootDir?: string

  /** The path to your `nuxt.config` file (either absolute or relative to your project `rootDir`). */
  configFile?: string

  /** Any overrides to your Nuxt configuration. */
  config?: Record<string, any>

  /** Configuration for loading dotenv */
  dotenv?: DotenvOptions | false
}

export async function loadNuxtConfig (opts: LoadNuxtConfigOptions): Promise<NuxtOptions> {
  const rootDir = resolve(process.cwd(), opts.rootDir || '.')

  if (opts.dotenv !== false) {
    await setupDotenv({ rootDir, ...opts.dotenv })
  }

  const nuxtConfigFile = tryResolveModule(resolve(rootDir, opts.configFile || 'nuxt.config'))

  let nuxtConfig: any = {}

  if (nuxtConfigFile && existsSync(nuxtConfigFile)) {
    nuxtConfig = requireModule(nuxtConfigFile, { clearCache: true })

    if (typeof nuxtConfig === 'function') {
      nuxtConfig = await nuxtConfig(opts)
    }

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
  return applyDefaults(NuxtConfigSchema, nuxtConfig) as NuxtOptions
}
