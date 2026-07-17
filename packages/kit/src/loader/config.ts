import { existsSync } from 'node:fs'
import process from 'node:process'
import type { JSValue } from 'untyped'
import { applyDefaults } from 'untyped'
import type { ConfigLayer, ConfigLayerMeta, LoadConfigOptions } from 'c12'
import { loadConfig, setupDotenv } from 'c12'
import type { NuxtConfig, NuxtOptions } from '@nuxt/schema'
import { glob } from 'tinyglobby'
import { createDefu, defu } from 'defu'
import { basename, join, relative, resolve } from 'pathe'
import { resolveModuleURL } from 'exsolve'
import { withTrailingSlash, withoutTrailingSlash } from 'ufo'

import { directoryToURL } from '../internal/esm.ts'

export interface LoadNuxtConfigOptions extends Omit<LoadConfigOptions<NuxtConfig>, 'overrides'> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  overrides?: Exclude<LoadConfigOptions<NuxtConfig>['overrides'], Promise<any> | Function>
}

const merger = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = obj[key].concat(value)
    return true
  }
})

export async function loadNuxtConfig (opts: LoadNuxtConfigOptions): Promise<NuxtOptions> {
  // Automatically detect and import layers from `~~/layers/` directory
  const localLayers = (await glob('layers/*', {
    onlyDirectories: true, cwd: opts.cwd || process.cwd(),
  }))
    .map((d: string) => withTrailingSlash(d))
    .sort((a, b) => b.localeCompare(a))
  opts.overrides = defu(opts.overrides, { _extends: localLayers })

  // Allow ordering `layers/` directories through `extends` (supporting `~`/`~~`/`@`/`@@` aliases).
  // We record the order of local layers referenced in the project's `extends` and resolve alias
  // paths ourselves, since c12 does not expand these aliases when resolving extend sources.
  const rootCwd = resolve(opts.cwd || process.cwd())
  const autoScanSources = new Set(localLayers)
  const localLayerDirs = new Set(localLayers.map(dir => withoutTrailingSlash(resolve(rootCwd, dir))))
  const extendsLocalLayerDirs: string[] = []
  const resolveExtends: LoadConfigOptions<NuxtConfig>['resolve'] = async (id, resolveOptions) => {
    if (typeof id !== 'string') { return undefined }
    const base = resolveOptions.cwd ? resolve(resolveOptions.cwd) : rootCwd
    const aliased = resolveLayerExtendsAlias(id, base)
    // Only the root project's `extends` reorders local layers; skip the auto-scan injections
    if (base === rootCwd && !autoScanSources.has(id)) {
      const layerDir = withoutTrailingSlash(aliased ?? resolve(rootCwd, id))
      if (localLayerDirs.has(layerDir)) {
        extendsLocalLayerDirs.push(layerDir)
      }
    }
    if (!aliased) { return undefined }
    // Resolve alias-prefixed layer directories ourselves so c12 does not fail on the unexpanded path
    const layer = await loadConfig<NuxtConfig>({
      cwd: aliased,
      name: 'nuxt',
      configFile: 'nuxt.config',
      rcFile: false,
      extend: false,
      jiti: resolveOptions.jiti,
    })
    return layer.configFile
      ? { config: layer.config, configFile: layer.configFile, cwd: aliased, source: aliased, meta: layer.meta }
      : undefined
  }

  // populate process.env before the schema imports its env-based defaults
  if (opts.dotenv !== false) {
    await setupDotenv({
      cwd: opts.cwd || process.cwd(),
      ...(typeof opts.dotenv === 'object' ? opts.dotenv : {}),
    })
  }

  const schemaPromise = loadNuxtSchema(opts.cwd || process.cwd())

  const { configFile, layers = [], cwd, config: nuxtConfig, meta } = await withDefineNuxtConfig(
    () => loadConfig<NuxtConfig>({
      name: 'nuxt',
      configFile: 'nuxt.config',
      rcFile: '.nuxtrc',
      extend: { extendKey: ['theme', '_extends', 'extends'] },
      resolve: resolveExtends,
      globalRc: true,
      // @ts-expect-error TODO: fix type in c12, it should accept createDefu directly
      merger,
      ...opts,
      dotenv: false, // already loaded above
    }),
  )

  // Fill config
  nuxtConfig.rootDir ||= cwd
  nuxtConfig._nuxtConfigFile = configFile
  nuxtConfig._nuxtConfigFiles = [configFile]
  nuxtConfig._loadOptions = opts
  // explicit `envName` (e.g. from `nuxt --envName`) takes precedence over `nuxt.config`,
  // matching how `c12` selects `$env.*` overrides
  if (typeof opts.envName === 'string') {
    nuxtConfig.envName = opts.envName
  }
  nuxtConfig.alias ||= {}

  if (meta?.name) {
    const alias = `#layers/${meta.name}`
    nuxtConfig.alias[alias] ||= withTrailingSlash(nuxtConfig.rootDir)
  }

  const defaultBuildDir = join(nuxtConfig.rootDir!, '.nuxt')
  if (!opts.overrides?._prepare && !nuxtConfig.dev && !nuxtConfig.buildDir && existsSync(defaultBuildDir)) {
    nuxtConfig.buildDir = join(nuxtConfig.rootDir!, 'node_modules/.cache/nuxt/.nuxt')
  }

  const NuxtConfigSchema = await schemaPromise

  const layerSchemaKeys = ['future', 'srcDir', 'rootDir', 'serverDir', 'dir']
  const layerSchema = Object.create(null)
  for (const key of layerSchemaKeys) {
    if (key in NuxtConfigSchema) {
      layerSchema[key] = NuxtConfigSchema[key]
    }
  }

  const _layers: ConfigLayer<NuxtConfig, ConfigLayerMeta>[] = []
  const processedLayers = new Set<string>()
  const localRelativePaths = new Set(localLayers.map(layer => withoutTrailingSlash(layer)))
  for (const layer of layers) {
    // Resolve `rootDir` & `srcDir` of layers
    // Create a shallow copy to avoid mutating the cached ESM config object
    const resolvedRootDir = layer.config?.rootDir ?? layer.cwd!
    layer.config = {
      ...(layer.config || {}),
      rootDir: resolvedRootDir,
    }

    // Only process/resolve layers once
    if (processedLayers.has(resolvedRootDir)) { continue }
    processedLayers.add(resolvedRootDir)

    // Normalise layer directories
    layer.config = await applyDefaults(layerSchema, layer.config as NuxtConfig & Record<string, JSValue>) as unknown as NuxtConfig

    // Filter layers
    if (!layer.configFile || layer.configFile.endsWith('.nuxtrc')) { continue }

    // Add layer name for local layers
    if (layer.cwd && cwd && localRelativePaths.has(relative(cwd, layer.cwd))) {
      layer.meta ||= {}
      layer.meta.name ||= basename(layer.cwd)
    }

    // Add layer alias
    if (layer.meta?.name) {
      const alias = `#layers/${layer.meta.name}`
      nuxtConfig.alias[alias] ||= withTrailingSlash(layer.config.rootDir || layer.cwd)
    }
    _layers.push(layer)
  }

  // Reorder local layers referenced in `extends` to their listed order (first entry = highest priority);
  // local layers not listed keep their alphabetical order at a lower priority than the listed ones.
  if (extendsLocalLayerDirs.length) {
    reorderLocalLayersByExtends(_layers, extendsLocalLayerDirs, localLayerDirs)
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

const LAYER_EXTENDS_ALIASES = ['~~', '@@', '~', '@']

/**
 * Resolve a leading `~`, `~~`, `@` or `@@` alias in an `extends` source to an absolute path.
 *
 * Layers in the `layers/` directory live at the project root, so all of these aliases are resolved
 * relative to `rootDir`. Returns `undefined` when the source is not alias-prefixed.
 */
function resolveLayerExtendsAlias (source: string, rootDir: string): string | undefined {
  for (const alias of LAYER_EXTENDS_ALIASES) {
    if (source === alias) { return rootDir }
    if (source.startsWith(`${alias}/`)) {
      return join(rootDir, source.slice(alias.length + 1))
    }
  }
  return undefined
}

/**
 * Reorder local layers (from the `~~/layers/` directory) in place according to the order they are
 * listed in `extends`. Listed layers come first, in `extends` order (first entry = highest priority);
 * unlisted local layers keep their existing alphabetical order after them. Other layers are untouched.
 */
function reorderLocalLayersByExtends (
  layers: ConfigLayer<NuxtConfig, ConfigLayerMeta>[],
  extendsOrder: string[],
  localLayerDirs: Set<string>,
) {
  const priorityByDir = new Map(extendsOrder.map((dir, index) => [dir, index]))
  const layerDir = (layer: ConfigLayer<NuxtConfig, ConfigLayerMeta>) => withoutTrailingSlash(layer.config?.rootDir ?? layer.cwd ?? '')

  const localSlots: number[] = []
  const localLayers: ConfigLayer<NuxtConfig, ConfigLayerMeta>[] = []
  for (let index = 0; index < layers.length; index++) {
    if (localLayerDirs.has(layerDir(layers[index]!))) {
      localSlots.push(index)
      localLayers.push(layers[index]!)
    }
  }

  const orderedLocalLayers = localLayers
    .map((layer, index) => ({ layer, index }))
    .sort((a, b) => {
      const priorityA = priorityByDir.get(layerDir(a.layer)) ?? Number.POSITIVE_INFINITY
      const priorityB = priorityByDir.get(layerDir(b.layer)) ?? Number.POSITIVE_INFINITY
      return priorityA - priorityB || a.index - b.index
    })
    .map(entry => entry.layer)

  localSlots.forEach((slot, index) => {
    layers[slot] = orderedLocalLayers[index]!
  })
}

function loadNuxtSchema (cwd: string) {
  const url = directoryToURL(cwd)
  const urls: Array<URL | string> = [url]
  const nuxtPath = resolveModuleURL('nuxt', { try: true, from: url }) ?? resolveModuleURL('nuxt-nightly', { try: true, from: url })
  if (nuxtPath) {
    urls.unshift(nuxtPath)
  }
  const schemaPath = resolveModuleURL('@nuxt/schema', { try: true, from: urls }) ?? '@nuxt/schema'
  return import(schemaPath).then(r => r.NuxtConfigSchema)
}

async function withDefineNuxtConfig<T> (fn: () => Promise<T>) {
  const key = 'defineNuxtConfig'
  const globalSelf = globalThis as any

  if (!globalSelf[key]) {
    globalSelf[key] = (c: any) => c
    globalSelf[key].count = 0
  }
  globalSelf[key].count++
  try {
    return await fn()
  } finally {
    globalSelf[key].count--
    if (!globalSelf[key].count) {
      delete globalSelf[key]
    }
  }
}
