import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import type { JSValue } from 'untyped'
import { applyDefaults } from 'untyped'
import type { ConfigLayer, ConfigLayerMeta, LoadConfigOptions } from 'c12'
import { loadConfig } from 'c12'
import type { NuxtConfig, NuxtOptions } from '@nuxt/schema'
import { NuxtConfigSchema } from '@nuxt/schema'
import defu from 'defu'
import { join } from 'pathe'

export interface LoadNuxtConfigOptions extends Omit<LoadConfigOptions<NuxtConfig>, 'overrides'> {
  overrides?: Exclude<LoadConfigOptions<NuxtConfig>['overrides'], Promise<any> | Function>
}

const layerSchemaKeys = ['future', 'srcDir', 'rootDir', 'dir']
const layerSchema = Object.create(null)
for (const key of layerSchemaKeys) {
  if (key in NuxtConfigSchema) {
    layerSchema[key] = NuxtConfigSchema[key]
  }
}

export async function loadNuxtConfig (opts: LoadNuxtConfigOptions): Promise<NuxtOptions> {
  // Automatically detect and import layers from `~~/layers/` directory
  const _extends: string[] = []
  const layersDir = join(opts.cwd || process.cwd(), 'layers')
  if (existsSync(layersDir)) {
    for (const file of await readdir(layersDir, { withFileTypes: true })) {
      if (file.isDirectory()) {
        _extends.push(join(layersDir, file.name))
      }
    }
  }
  opts.overrides = defu(opts.overrides, { _extends });
  (globalThis as any).defineNuxtConfig = (c: any) => c
  const result = await loadConfig<NuxtConfig>({
    name: 'nuxt',
    configFile: 'nuxt.config',
    rcFile: '.nuxtrc',
    extend: { extendKey: ['theme', 'extends', '_extends'] },
    dotenv: true,
    globalRc: true,
    ...opts,
  })
  delete (globalThis as any).defineNuxtConfig
  const { configFile, layers = [], cwd } = result
  const nuxtConfig = result.config!

  // Fill config
  nuxtConfig.rootDir = nuxtConfig.rootDir || cwd
  nuxtConfig._nuxtConfigFile = configFile
  nuxtConfig._nuxtConfigFiles = [configFile]

  const _layers: ConfigLayer<NuxtConfig, ConfigLayerMeta>[] = []
  const processedLayers = new Set<string>()
  for (const layer of layers) {
    // Resolve `rootDir` & `srcDir` of layers
    layer.config = layer.config || {}
    layer.config.rootDir = layer.config.rootDir ?? layer.cwd!

    // Only process/resolve layers once
    if (processedLayers.has(layer.config.rootDir)) { continue }
    processedLayers.add(layer.config.rootDir)

    // Normalise layer directories
    layer.config = await applyDefaults(layerSchema, layer.config as NuxtConfig & Record<string, JSValue>) as unknown as NuxtConfig

    // Filter layers
    if (!layer.configFile || layer.configFile.endsWith('.nuxtrc')) { continue }
    _layers.push(layer)
  }

  ;(nuxtConfig as any)._layers = _layers

  // Ensure at least one layer remains (without nuxt.config)
  if (!_layers.length) {
    _layers.push({
      cwd,
      config: {
        rootDir: cwd,
        srcDir: cwd,
      },
    })
  }

  // Resolve and apply defaults
  return await applyDefaults(NuxtConfigSchema, nuxtConfig as NuxtConfig & Record<string, JSValue>) as unknown as NuxtOptions
}
