import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { JSValue } from 'untyped'
import { applyDefaults } from 'untyped'
import type { ConfigLayer, ConfigLayerMeta, LoadConfigOptions } from 'c12'
import { loadConfig } from 'c12'
import type { NuxtConfig, NuxtOptions } from '@nuxt/schema'
import { globby } from 'globby'
import defu from 'defu'
import { basename, join, relative } from 'pathe'
import { isWindows } from 'std-env'
import { directoryToURL, tryResolveModule } from '../internal/esm'

export interface LoadNuxtConfigOptions extends Omit<LoadConfigOptions<NuxtConfig>, 'overrides'> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  overrides?: Exclude<LoadConfigOptions<NuxtConfig>['overrides'], Promise<any> | Function>
}

export async function loadNuxtConfig (opts: LoadNuxtConfigOptions): Promise<NuxtOptions> {
  // Automatically detect and import layers from `~~/layers/` directory
  const localLayers = await globby('layers/*', { onlyDirectories: true, cwd: opts.cwd || process.cwd() })
  opts.overrides = defu(opts.overrides, { _extends: localLayers });

  (globalThis as any).defineNuxtConfig = (c: any) => c
  const { configFile, layers = [], cwd, config: nuxtConfig, meta } = await loadConfig<NuxtConfig>({
    name: 'nuxt',
    configFile: 'nuxt.config',
    rcFile: '.nuxtrc',
    extend: { extendKey: ['theme', 'extends', '_extends'] },
    dotenv: true,
    globalRc: true,
    ...opts,
  })
  delete (globalThis as any).defineNuxtConfig

  // Fill config
  nuxtConfig.rootDir ||= cwd
  nuxtConfig._nuxtConfigFile = configFile
  nuxtConfig._nuxtConfigFiles = [configFile]
  nuxtConfig.alias ||= {}

  if (meta?.name) {
    const alias = `#layers/${meta.name}`
    nuxtConfig.alias[alias] ||= nuxtConfig.rootDir
  }

  const defaultBuildDir = join(nuxtConfig.rootDir!, '.nuxt')
  if (!opts.overrides?._prepare && !nuxtConfig.dev && !nuxtConfig.buildDir && existsSync(defaultBuildDir)) {
    nuxtConfig.buildDir = join(nuxtConfig.rootDir!, 'node_modules/.cache/nuxt/.nuxt')
  }

  const NuxtConfigSchema = await loadNuxtSchema(nuxtConfig.rootDir || cwd || process.cwd())

  const layerSchemaKeys = ['future', 'srcDir', 'rootDir', 'serverDir', 'dir']
  const layerSchema = Object.create(null)
  for (const key of layerSchemaKeys) {
    if (key in NuxtConfigSchema) {
      layerSchema[key] = NuxtConfigSchema[key]
    }
  }

  const _layers: ConfigLayer<NuxtConfig, ConfigLayerMeta>[] = []
  const processedLayers = new Set<string>()
  for (const layer of layers) {
    // Resolve `rootDir` & `srcDir` of layers
    layer.config ||= {}
    layer.config.rootDir ??= layer.cwd!

    // Only process/resolve layers once
    if (processedLayers.has(layer.config.rootDir)) { continue }
    processedLayers.add(layer.config.rootDir)

    // Normalise layer directories
    layer.config = await applyDefaults(layerSchema, layer.config as NuxtConfig & Record<string, JSValue>) as unknown as NuxtConfig

    // Filter layers
    if (!layer.configFile || layer.configFile.endsWith('.nuxtrc')) { continue }

    // Add layer name for local layers
    if (layer.cwd && cwd && localLayers.includes(relative(cwd, layer.cwd))) {
      layer.meta ||= {}
      layer.meta.name ||= basename(layer.cwd)
    }

    // Add layer alias
    if (layer.meta?.name) {
      const alias = `#layers/${layer.meta.name}`
      nuxtConfig.alias[alias] ||= layer.config.rootDir || layer.cwd
    }
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

async function loadNuxtSchema (cwd: string) {
  const url = directoryToURL(cwd)
  const urls = [url]
  const nuxtPath = await tryResolveModule('nuxt', url) ?? await tryResolveModule('nuxt-nightly', url)
  if (nuxtPath) {
    urls.unshift(pathToFileURL(nuxtPath))
  }
  const schemaPath = await tryResolveModule('@nuxt/schema', urls) ?? '@nuxt/schema'
  return await import(isWindows ? pathToFileURL(schemaPath).href : schemaPath).then(r => r.NuxtConfigSchema)
}
