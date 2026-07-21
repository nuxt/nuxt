import { existsSync, realpathSync, statSync } from 'node:fs'
import process from 'node:process'
import type { JSValue } from 'untyped'
import { applyDefaults } from 'untyped'
import type { ConfigLayer, ConfigLayerMeta, LoadConfigOptions } from 'c12'
import { loadConfig, setupDotenv } from 'c12'
import type { NuxtConfig, NuxtOptions } from '@nuxt/schema'
import { glob } from 'tinyglobby'
import { createDefu, defu } from 'defu'
import { basename, dirname, join, normalize, relative, resolve } from 'pathe'
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
  const rootCwd = resolve(opts.cwd || process.cwd())

  // Automatically detect and import layers from `~~/layers/` directory
  const localLayers = (await glob('layers/*', {
    onlyDirectories: true, cwd: rootCwd,
  }))
    .map((d: string) => withTrailingSlash(d))
    .sort((a, b) => b.localeCompare(a))
  opts.overrides = defu(opts.overrides, { _extends: localLayers })

  // Identity of the auto-scan `_extends` injections (so the root project's own `extends`
  // can be told apart from them) and the canonical directory of every local layer.
  const autoScanSources = new Set(localLayers)
  const localLayerDirs = new Set(
    localLayers.map(dir => canonicalLayerDir(resolve(rootCwd, withoutTrailingSlash(dir)))),
  )
  // Local layers referenced in the root project's `extends`, in listed order (first = highest
  // priority). Used to reorder the auto-scanned layers so ordering can be driven from
  // `nuxt.config` without renaming directories.
  const extendsLocalLayerOrder: string[] = []

  // populate process.env before the schema imports its env-based defaults
  if (opts.dotenv !== false) {
    await setupDotenv({
      cwd: opts.cwd || process.cwd(),
      ...(typeof opts.dotenv === 'object' ? opts.dotenv : {}),
    })
  }

  const schemaPromise = loadNuxtSchema(opts.cwd || process.cwd())

  // Dedupe local layer directories reached more than once (auto-scanned from
  // `layers/` and also listed in `extends`) to avoid merging them twice (#34667)
  const seenLayerDirs = new Set<string>()

  const { configFile, layers = [], cwd, config: nuxtConfig, meta } = await withDefineNuxtConfig(
    () => loadConfig<NuxtConfig>({
      name: 'nuxt',
      configFile: 'nuxt.config',
      rcFile: '.nuxtrc',
      extend: { extendKey: ['theme', '_extends', 'extends'] },
      globalRc: true,
      // @ts-expect-error TODO: fix type in c12, it should accept createDefu directly
      merger,
      ...opts,
      dotenv: false, // already loaded above
      async resolve (source, resolveOptions) {
        // Respect a user-provided resolver
        const custom = await opts.resolve?.(source, resolveOptions)
        if (custom) { return custom }
        if (typeof source !== 'string') { return }
        const base = resolveOptions.cwd ? resolve(resolveOptions.cwd) : rootCwd
        // Expand `~`/`~~`/`@`/`@@` aliases, which c12 does not understand in extend sources.
        // Local layers live at the project root, so every alias form resolves against `rootCwd`.
        const aliased = resolveLayerExtendsAlias(source, rootCwd)
        // Only dedupe local sources; packages/remote sources are left to c12
        const path = aliased ?? resolve(base, source)
        if (!existsSync(path)) { return }
        // Canonicalise to the layer directory so different spellings of the same
        // layer share one identity: a config-file path -> its directory, and a
        // symlink -> its target
        const layerDir = canonicalLayerDir(path)
        // Record the order local layers are listed in the root project's own `extends`
        // (not the auto-scan `_extends` injection) so they can be reordered afterwards
        if (base === rootCwd && !autoScanSources.has(source) && localLayerDirs.has(layerDir)) {
          extendsLocalLayerOrder.push(layerDir)
        }
        if (seenLayerDirs.has(layerDir)) {
          // Empty layer so the repeat contributes nothing to the merge; a nullish
          // return would let c12 resolve and merge the same layer again
          return { config: {}, cwd: layerDir, source }
        }
        seenLayerDirs.add(layerDir)
        // Hand c12 a resolved config for alias-prefixed sources; it would otherwise
        // choke on the unexpanded `~~/...` path
        if (aliased) {
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
            : { config: {}, cwd: aliased, source }
        }
      },
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

  // Reorder auto-scanned local layers to follow the order they are listed in `extends`
  // (first entry = highest priority); unlisted local layers keep their alphabetical order
  // below the listed ones. Other layers are left untouched.
  if (extendsLocalLayerOrder.length) {
    reorderLocalLayersByExtends(_layers, extendsLocalLayerOrder, localLayerDirs)
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

/**
 * Canonicalise a filesystem path to a layer directory: config-file paths collapse to their
 * directory and symlinks resolve to their target, so different spellings of the same layer
 * share one identity. The path must exist.
 */
function canonicalLayerDir (path: string): string {
  return normalize(realpathSync(statSync(path).isDirectory() ? path : dirname(path)))
}

const LAYER_EXTENDS_ALIASES = ['~~', '@@', '~', '@']

/**
 * Resolve a leading `~`, `~~`, `@` or `@@` alias in an `extends` source to an absolute path.
 * Local layers live at the project root, so every alias resolves against `rootDir`. Returns
 * `undefined` when the source is not alias-prefixed.
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
 * Reorder local layers (from the `~~/layers/` directory) in place to match the order they are
 * listed in `extends` (first entry = highest priority). Listed layers come first in that order;
 * unlisted local layers keep their existing alphabetical order after them. Non-local layers keep
 * their positions.
 */
function reorderLocalLayersByExtends (
  layers: ConfigLayer<NuxtConfig, ConfigLayerMeta>[],
  extendsOrder: string[],
  localLayerDirs: Set<string>,
) {
  const layerDir = (layer: ConfigLayer<NuxtConfig, ConfigLayerMeta>) => {
    const dir = withoutTrailingSlash(layer.config?.rootDir ?? layer.cwd ?? '')
    try {
      return normalize(realpathSync(dir))
    } catch {
      return normalize(dir)
    }
  }

  const priorityByDir = new Map(extendsOrder.map((dir, index) => [dir, index]))

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
