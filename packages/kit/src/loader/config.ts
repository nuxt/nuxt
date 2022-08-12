import { resolve } from 'pathe'
import { applyDefaults } from 'untyped'
import { loadConfig, LoadConfigOptions } from 'c12'
import type { NuxtOptions, NuxtConfig } from '@nuxt/schema'
import { NuxtConfigSchema } from '@nuxt/schema'

export interface LoadNuxtConfigOptions extends LoadConfigOptions<NuxtConfig> {}

export async function loadNuxtConfig (opts: LoadNuxtConfigOptions): Promise<NuxtOptions> {
  const { config: nuxtConfig, configFile, layers, cwd } = await loadConfig<NuxtConfig>({
    name: 'nuxt',
    configFile: 'nuxt.config',
    rcFile: '.nuxtrc',
    dotenv: true,
    globalRc: true,
    ...opts
  })

  // Fill config
  nuxtConfig.rootDir = nuxtConfig.rootDir || cwd
  nuxtConfig._nuxtConfigFile = configFile
  nuxtConfig._nuxtConfigFiles = [configFile]

  // Resolve `rootDir` & `srcDir` of layers
  for (const layer of layers) {
    layer.config = layer.config || {}
    layer.config.rootDir = layer.config.rootDir ?? layer.cwd
    layer.config.srcDir = resolve(layer.config.rootDir, layer.config.srcDir)
  }

  // Filter layers
  nuxtConfig._layers = layers.filter(layer => layer.configFile && !layer.configFile.endsWith('.nuxtrc'))

  // Resolve and apply defaults
  return applyDefaults(NuxtConfigSchema, nuxtConfig) as NuxtOptions
}
