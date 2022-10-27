import { resolve } from 'pathe'
import { applyDefaults } from 'untyped'
import { loadConfig, LoadConfigOptions } from 'c12'
import type { NuxtOptions, NuxtConfig } from '@nuxt/schema'
import { NuxtConfigSchema } from '@nuxt/schema'

export interface LoadNuxtConfigOptions extends LoadConfigOptions<NuxtConfig> {}

export async function loadNuxtConfig (opts: LoadNuxtConfigOptions): Promise<NuxtOptions> {
  (globalThis as any).defineNuxtConfig = (c: any) => c
  const result = await loadConfig<NuxtConfig>({
    name: 'nuxt',
    configFile: 'nuxt.config',
    rcFile: '.nuxtrc',
    extend: { extendKey: ['theme', 'extends'] },
    dotenv: true,
    globalRc: true,
    ...opts
  })
  delete (globalThis as any).defineNuxtConfig
  const { configFile, layers = [], cwd } = result
  const nuxtConfig = result.config!

  // Fill config
  nuxtConfig.rootDir = nuxtConfig.rootDir || cwd
  nuxtConfig._nuxtConfigFile = configFile
  nuxtConfig._nuxtConfigFiles = [configFile]

  // Resolve `rootDir` & `srcDir` of layers
  for (const layer of layers) {
    layer.config = layer.config || {}
    layer.config.rootDir = layer.config.rootDir ?? layer.cwd
    layer.config.srcDir = resolve(layer.config.rootDir!, layer.config.srcDir!)
  }

  // Filter layers
  const _layers = layers.filter(layer => layer.configFile && !layer.configFile.endsWith('.nuxtrc'))
  ;(nuxtConfig as any)._layers = _layers

  // Ensure at least one layer remains (without nuxt.config)
  if (!_layers.length) {
    _layers.push({
      cwd,
      config: {
        rootDir: cwd,
        srcDir: cwd
      }
    })
  }

  // Resolve and apply defaults
  return await applyDefaults(NuxtConfigSchema, nuxtConfig) as NuxtOptions
}
