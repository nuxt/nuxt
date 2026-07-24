import { existsSync, realpathSync, statSync } from 'node:fs'
import process from 'node:process'
import type { JSValue } from 'untyped'
import { applyDefaults } from 'untyped'
import type { ConfigLayer, ConfigLayerMeta, LoadConfigOptions } from 'c12'
import { loadConfig, setupDotenv } from 'c12'
import type { NuxtConfig, NuxtOptions } from '@nuxt/schema'
import { glob } from 'tinyglobby'
import { createDefu, defu } from 'defu'
import { klona } from 'klona/full'
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

  // Automatically detect and import layers from `~~/layers/` directory, sorted so that a
  // later directory overrides an earlier one (the `1.base`/`2.features`/`3.admin` convention)
  const localLayers = (await glob('layers/*', {
    onlyDirectories: true, cwd: rootCwd,
  }))
    .map((d: string) => withTrailingSlash(d))
    .sort((a, b) => b.localeCompare(a))

  // Order the auto-scan injection by the order local layers are listed in `extends` (first
  // listed = highest priority); unlisted layers keep their alphabetical order below them.
  // Ordering the injection - rather than reordering the resolved layers afterwards - is what
  // lets the value merge (`runtimeConfig`, `appConfig`, ...) follow the same priority (#35822)
  const orderedLocalLayers = localLayers.length
    ? await orderLocalLayersByExtends(opts, rootCwd, localLayers)
    : localLayers
  opts.overrides = defu(opts.overrides, { _extends: orderedLocalLayers })

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

  const resolved = await withDefineNuxtConfig(
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
  const { configFile, layers = [], cwd, meta } = resolved
  const nuxtConfig = klona(resolved.config)

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
 * Order the auto-scanned local layers to match the order they are listed in the project's
 * `extends` (first listed = highest priority). Listed layers come first in that order; layers
 * not listed keep their existing alphabetical order after them.
 */
async function orderLocalLayersByExtends (
  opts: LoadNuxtConfigOptions,
  rootCwd: string,
  localLayers: string[],
): Promise<string[]> {
  const dirToLayer = new Map<string, string>()
  for (const layer of localLayers) {
    dirToLayer.set(canonicalLayerDir(resolve(rootCwd, withoutTrailingSlash(layer))), layer)
  }

  const listed: string[] = []
  const listedDirs = new Set<string>()
  for (const source of await readExtendsSources(opts, rootCwd)) {
    const dir = resolveExtendsSourceDir(source, rootCwd)
    const layer = dir ? dirToLayer.get(dir) : undefined
    if (dir && layer && !listedDirs.has(dir)) {
      listed.push(layer)
      listedDirs.add(dir)
    }
  }

  if (!listed.length) { return localLayers }

  const unlisted = localLayers.filter(
    layer => !listedDirs.has(canonicalLayerDir(resolve(rootCwd, withoutTrailingSlash(layer)))),
  )
  return [...listed, ...unlisted]
}

/**
 * Read the `extends` sources of the root project (its `nuxt.config`, `.nuxtrc` and `overrides`)
 * without resolving the referenced layers, so their listed order can drive the auto-scan
 * injection order. `extends` set from `$env` or by other layers is not visible here and does not
 * affect ordering.
 */
async function readExtendsSources (opts: LoadNuxtConfigOptions, rootCwd: string): Promise<string[]> {
  const { config } = await withDefineNuxtConfig(() => loadConfig<NuxtConfig>({
    cwd: rootCwd,
    name: 'nuxt',
    configFile: 'nuxt.config',
    rcFile: '.nuxtrc',
    globalRc: true,
    extend: false,
    dotenv: false,
    jiti: opts.jiti,
    overrides: opts.overrides as LoadConfigOptions<NuxtConfig>['overrides'],
  }))

  const extendsConfig = config.extends
  if (!extendsConfig) { return [] }
  const sources = Array.isArray(extendsConfig) ? extendsConfig : [extendsConfig]
  return sources
    .map(entry => Array.isArray(entry) ? entry[0] : entry)
    .filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Resolve an `extends` source (alias, relative or absolute path) to its canonical layer
 * directory, or `undefined` when it does not point at an existing path.
 */
function resolveExtendsSourceDir (source: string, rootCwd: string): string | undefined {
  const path = resolveLayerExtendsAlias(source, rootCwd) ?? resolve(rootCwd, source)
  if (!existsSync(path)) { return undefined }
  return canonicalLayerDir(path)
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
