import { resolve } from 'pathe'
import { applyDefaults } from 'untyped'
import { loadConfig, DotenvOptions } from 'c12'
import type { NuxtOptions } from '@nuxt/schema'
import { NuxtConfigSchema } from '@nuxt/schema'
// TODO
// import { tryResolveModule, requireModule, scanRequireTree } from '../internal/cjs'

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

  const { config: nuxtConfig, configFile, layers } = await loadConfig({
    cwd: rootDir,
    name: 'nuxt',
    configFile: 'nuxt.config',
    rcFile: '.nuxtrc',
    dotenv: typeof opts.dotenv === 'undefined' ? {} as DotenvOptions : opts.dotenv,
    globalRc: true,
    overrides: opts.config
  })

  nuxtConfig.rootDir = nuxtConfig.rootDir || rootDir

  nuxtConfig._nuxtConfigFile = configFile
  nuxtConfig._nuxtConfigFiles = [configFile]

  // Resolve `rootDir` & `srcDir` of layers
  for (const layer of layers) {
    layer.config.rootDir = layer.config.rootDir ?? layer.cwd
    layer.config.srcDir = resolve(layer.config.rootDir, layer.config.srcDir)
  }

  nuxtConfig._extends = layers

  // Resolve and apply defaults
  return applyDefaults(NuxtConfigSchema, nuxtConfig) as NuxtOptions
}
