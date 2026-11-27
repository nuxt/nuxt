import { existsSync, realpathSync, statSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { InputObject, JSValue } from 'untyped'
import { applyDefaults } from 'untyped'
import { loadConfig, setupDotenv } from 'c12'
import type { NitroConfig, NuxtConfig, NuxtConfigLayer, NuxtConfigLayerMeta, NuxtDotenvOptions, NuxtOptions } from '@nuxt/schema'
import { glob } from 'tinyglobby'
import { createDefu, defu } from 'defu'
import microdiff from 'microdiff'
import { basename, dirname, join, normalize, relative, resolve } from 'pathe'
import { resolveModuleURL } from 'exsolve'

import { directoryToURL } from '../internal/esm.ts'
import { describeMissingPackage, describeNativeImportFailure, getMissingCjsGlobal, getMissingPackage, isLoaderError, loadJiti, shouldReportJitiFallbackOnce } from '../internal/jiti.ts'
import type { Jiti } from '../internal/jiti.ts'
import { configDiagnostics } from '../diagnostics/config.ts'
import { extractRuntimeConfigSchemas, mergeRuntimeConfigSchemas, restoreRuntimeConfigSchemaNulls } from '../internal/runtime-config.ts'
import { ensureDependencyInstalled, getAddDependencyCommand } from '../dependency.ts'
import { kitDiagnostics } from '../diagnostics/kit-api.ts'

/**
 * A layer as it comes back from the underlying config loader, before its directory options have
 * been normalised into a {@link NuxtConfigLayer}.
 */
interface LoadedConfigLayer extends Omit<ResolvedNuxtLayer, 'config'> {
  config: NuxtConfig | null
}

/**
 * Context handed to `onConfigResolved` after configuration has loaded successfully.
 */
export interface ResolvedNuxtConfigContext {
  /**
   * User configuration merged across all layers, with no schema defaults applied and with
   * `overrides`, `defaults` and `defaultConfig` from the load options excluded, so repeated
   * loads of an unchanged project produce an unchanged snapshot. Two snapshots from separate
   * `loadNuxtConfig` calls can be compared with `diffNuxtConfig`.
   */
  rawConfig: NuxtConfig
  /** Resolved config layers, highest priority first. */
  layers: NuxtConfigLayer[]
  /** Absolute path of the root `nuxt.config` file, if one was found. */
  configFile?: string
  /** Directory the configuration was loaded from. */
  cwd: string
}

/** A layer produced by a custom {@link LoadNuxtConfigOptions.resolve} implementation. */
export interface ResolvedNuxtLayer {
  /** The layer's configuration. Return an empty object to contribute nothing to the merge. */
  config: NuxtConfig
  /** Absolute path of the directory the layer was loaded from. */
  cwd?: string
  /** Absolute path of the layer's config file, if it has one. */
  configFile?: string
  /** The `extends` entry this layer was resolved from. */
  source?: string
  /** Metadata to attach to the layer. */
  meta?: NuxtConfigLayerMeta
}

/** Context passed to a custom {@link LoadNuxtConfigOptions.resolve} implementation. */
export interface NuxtLayerResolverContext {
  /** Directory the layer source should be resolved relative to. */
  cwd?: string
  /**
   * The importer in use for the current load, if one has been established. Pass it to any
   * nested load so a layer is not loaded through a second, differently configured importer.
   */
  import?: (id: string) => Promise<unknown>
}

export interface LoadNuxtConfigOptions {
  /** Directory to load `nuxt.config` from. @default process.cwd() */
  cwd?: string
  /**
   * Name of the config file to load, without an extension.
   * @default 'nuxt.config'
   */
  configFile?: string
  /**
   * Name of the `.rc` file to load alongside the config file, or `false` to load none.
   * @default '.nuxtrc'
   */
  rcFile?: string | false
  /**
   * Also load the user-level and workspace-level `.nuxtrc` files.
   * @default true
   */
  globalRc?: boolean
  /**
   * Configuration applied above every layer, including the root project's own `nuxt.config`.
   * Excluded from the `rawConfig` snapshot passed to `onConfigResolved`.
   */
  overrides?: NuxtConfig
  /**
   * Configuration applied below every layer, before schema defaults. Excluded from the
   * `rawConfig` snapshot passed to `onConfigResolved`.
   */
  defaults?: NuxtConfig
  /**
   * Load `.env` files into `process.env` before resolving configuration. Set to `false` when
   * the environment has already been populated.
   * @default true
   */
  dotenv?: boolean | NuxtDotenvOptions
  /**
   * Environment name used to select `$env.*` configuration overrides. Takes precedence over
   * `envName` set in `nuxt.config`.
   */
  envName?: string | false
  /**
   * Resolve an `extends` entry to a layer yourself. Return a nullish value to fall back to the
   * default resolution for that source.
   */
  resolve?: (source: string, context: NuxtLayerResolverContext) => ResolvedNuxtLayer | null | undefined | Promise<ResolvedNuxtLayer | null | undefined>
  /**
   * Import config files with a custom loader rather than the default one. Supply this to load
   * TypeScript config without Nuxt reaching for `jiti`.
   */
  import?: (id: string) => Promise<unknown>
  /**
   * Called once, awaited, after configuration has loaded successfully. Callers watching config
   * files themselves can keep the previous `rawConfig` and pass both snapshots to
   * `diffNuxtConfig` to find out which keys changed. Not called if loading throws.
   */
  onConfigResolved?: (context: ResolvedNuxtConfigContext) => void | Promise<void>
}

interface NuxtConfigDiffLocation {
  /**
   * Property path of the changed value, with array indices as numbers: `['modules']`,
   * `['runtimeConfig', 'public', 'foo']`, `['modules', 0]`. Prefer this over {@link label} when
   * reading the value back out of a config object.
   */
  path: Array<string | number>
  /**
   * {@link path} written as a property accessor, for display and for matching against a known
   * key: `ssr`, `runtimeConfig.public.foo`, `modules[0]`, `nitro.routeRules["/index.html"].ssr`.
   */
  label: string
}

const IDENTIFIER_RE = /^[a-z_$][\w$]*$/i

function formatLabel (path: Array<string | number>) {
  let label = ''
  for (const segment of path) {
    if (typeof segment === 'number') {
      label += `[${segment}]`
    } else if (IDENTIFIER_RE.test(segment)) {
      label += label ? `.${segment}` : segment
    } else {
      label += `[${JSON.stringify(segment)}]`
    }
  }
  return label
}

/** A single difference between two resolved Nuxt configurations. */
export type NuxtConfigDiffEntry =
  | (NuxtConfigDiffLocation & { type: 'added', newValue: unknown })
  | (NuxtConfigDiffLocation & { type: 'removed', oldValue: unknown })
  | (NuxtConfigDiffLocation & { type: 'changed', newValue: unknown, oldValue: unknown })

/**
 * Compare two `rawConfig` snapshots (as provided to `onConfigResolved`) and return the
 * differences between them.
 */
export function diffNuxtConfig (oldConfig: NuxtConfig, newConfig: NuxtConfig): NuxtConfigDiffEntry[] {
  const entries: NuxtConfigDiffEntry[] = []

  for (const entry of microdiff(oldConfig, newConfig)) {
    const location = { path: entry.path, label: formatLabel(entry.path) }
    switch (entry.type) {
      case 'CREATE':
        entries.push({ ...location, type: 'added', newValue: entry.value })
        break
      case 'REMOVE':
        entries.push({ ...location, type: 'removed', oldValue: entry.oldValue })
        break
      case 'CHANGE':
        if (!isSameFunction(entry.oldValue, entry.value)) {
          entries.push({ ...location, type: 'changed', newValue: entry.value, oldValue: entry.oldValue })
        }
        break
    }
  }

  return entries
}

function isSameFunction (a: unknown, b: unknown) {
  return typeof a === 'function' && typeof b === 'function' && a.toString() === b.toString()
}

// The extensions `c12` teaches jiti about, so that an extensionless import inside a config file
// resolves the same way whether or not the fallback is in play.
const CONFIG_EXTENSIONS = ['.js', '.ts', '.mjs', '.cjs', '.mts', '.cts', '.json', '.jsonc', '.json5', '.yaml', '.yml', '.toml'] as const

// Process-wide, so that a second `loadNuxtConfig` for the same project produces a different URL
// and re-reads the file rather than getting the cached module back
let configImportCounter = 0

const TYPELESS_MODULE_RE = /^Module type of (\S+) is not specified/
const TYPELESS_PACKAGE_JSON_RE = /add "type": "module" to (.+)\.$/m
const activeConfigImports = new Map<string, number>()
let emitWarning: typeof process.emitWarning | undefined

/**
 * Report Node's warning about the config file at `filePath` being in a package with no `type` as a
 * Nuxt diagnostic, for as long as the returned function has not been called. Warnings about other
 * modules are passed through unchanged.
 */
function interceptTypelessPackageWarnings (filePath: string): () => void {
  filePath = normalize(filePath)
  activeConfigImports.set(filePath, (activeConfigImports.get(filePath) ?? 0) + 1)
  if (!emitWarning) {
    const original = emitWarning = process.emitWarning
    process.emitWarning = function (warning: string | Error, ...args: unknown[]) {
      const options = args[0]
      const code = options && typeof options === 'object' ? (options as { code?: unknown }).code : args[1]
      const message = String(warning)
      const packageJson = message.match(TYPELESS_PACKAGE_JSON_RE)?.[1]
      const url = message.match(TYPELESS_MODULE_RE)?.[1]
      const modulePath = url?.startsWith('file:') ? normalize(fileURLToPath(url)) : undefined
      if (code !== 'MODULE_TYPELESS_PACKAGE_JSON' || !packageJson || !modulePath || !activeConfigImports.has(modulePath)) {
        return (original as (...args: unknown[]) => void).call(process, warning, ...args)
      }
      configDiagnostics.NUXT_B5040({ filePath: modulePath, packageJson: normalize(packageJson) })
    } as typeof process.emitWarning
  }
  return () => {
    const remaining = (activeConfigImports.get(filePath) ?? 1) - 1
    if (remaining) {
      activeConfigImports.set(filePath, remaining)
    } else {
      activeConfigImports.delete(filePath)
    }
    if (activeConfigImports.size === 0 && emitWarning) {
      process.emitWarning = emitWarning
      emitWarning = undefined
    }
  }
}

// The `extends` sources the config loader hands to `giget`. Kept in step with c12; a prefix that
// is missing here only means the loader reports the missing downloader in its own words.
const REMOTE_SOURCE_RE = /^(?:gh|github|gitlab|bitbucket):|^https?:\/\//

/**
 * Check that a remote `extends` source can actually be downloaded, and explain the alternative if
 * not. `giget` is an optional peer dependency: most projects are better off adding the layer to
 * `package.json` with a git URL, which pins it and records it in the lockfile.
 */
async function assertRemoteLayerSupport (source: string, rootDir: string) {
  if (!await import('giget').then(() => true, () => false)) {
    throw configDiagnostics.NUXT_B5018({
      source,
      installCommand: await getAddDependencyCommand('giget', rootDir, { dev: true }),
    }, { method: 'error' })
  }
}

/**
 * Whether a config load failed because `confbox` is not installed. It is an optional peer
 * dependency, needed only to parse a `nuxt.config` written in yaml, toml, jsonc or json5.
 */
function isMissingConfbox (error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown, message?: unknown }
  return code === 'ERR_MODULE_NOT_FOUND' && typeof message === 'string' && message.includes(`'confbox`)
}

const merger = createDefu((obj, key, value, namespace) => {
  if (namespace ? namespace === 'runtimeConfig' || namespace.startsWith('runtimeConfig.') : key === 'runtimeConfig') {
    const merged = mergeRuntimeConfigSchemas(value, obj[key])
    if (merged !== undefined) {
      obj[key] = merged as typeof obj[typeof key]
      return true
    }
  }
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = obj[key].concat(value)
    return true
  }
})

export async function loadNuxtConfig (opts: LoadNuxtConfigOptions): Promise<NuxtOptions> {
  const rootCwd = resolve(opts.cwd || process.cwd())
  const configFileName = opts.configFile || 'nuxt.config'

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
    localLayers.map(dir => canonicalLayerDir(resolve(rootCwd, dir.replace(/\/$/, '')))),
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

  const resolverPromise = loadOptionsResolver(opts.cwd || process.cwd())

  // Dedupe local layer directories reached more than once (auto-scanned from
  // `layers/` and also listed in `extends`) to avoid merging them twice (#34667)
  const seenLayerDirs = new Set<string>()

  // Import config files with the runtime's own loader, falling back to jiti for anything it will
  // not load. This stands in for the equivalent fallback inside `c12` so that `jiti` is looked
  // for in the project as well as alongside `@nuxt/kit`, and so that a missing `jiti` is reported
  // with an install command. Resolved once per load, so a project without `jiti` is asked at most
  // once however many layers it has.
  let jitiPromise: Promise<Jiti | undefined> | undefined
  // Looking for jiti can mean offering to install it, so that is reserved for a failure jiti is
  // expected to fix; an ordinary mistake in a config file must never lead to a dependency prompt
  const getJiti = async (install: boolean) => {
    jitiPromise ??= loadJiti({ rootDir: rootCwd, install }).then(mod => mod?.createJiti(join(rootCwd, configFileName), {
      interopDefault: true,
      moduleCache: false,
      extensions: [...CONFIG_EXTENSIONS],
    }))
    const jiti = await jitiPromise
    // a lookup that was not allowed to install says nothing about one that is
    if (!jiti && !install) {
      jitiPromise = undefined
    }
    return jiti
  }
  // Set once the runtime has turned a config file down. Every later layer in the same load is
  // likely to be written the same way, so go straight to jiti rather than paying a failed import
  // for each one
  let jitiImporter: ((id: string) => Promise<unknown>) | undefined
  // Reported once `future.compatibilityVersion` is known, since that is part of deciding whether
  // loading through jiti is worth mentioning at all
  const jitiFallbacks: Array<{ filePath: string, error: string, hint: string, missingPackage: boolean }> = []

  const importConfigFile = async (id: string) => {
    if (jitiImporter) {
      return jitiImporter(id)
    }
    // `c12` appends a counter to defeat the module cache, so that repeated loads in dev pick up
    // edits to a config file; this has to do the same
    const url = pathToFileURL(id)
    url.search = `_${++configImportCounter}`
    const restoreWarnings = interceptTypelessPackageWarnings(id)
    try {
      return await import(url.href).finally(restoreWarnings)
    } catch (error) {
      const missingGlobal = getMissingCjsGlobal(error)
      const missingPackage = getMissingPackage(error)
      // Whether jiti is the answer, or the file simply has a bug that a second loader will repeat.
      // jiti may find a package the project does not depend on, which only hides the problem.
      const jitiCanHelp = !missingPackage && (isLoaderError(error) || !!missingGlobal)
      const missingPackageError = async (missing: NonNullable<typeof missingPackage>) => configDiagnostics.NUXT_B5017({
        filePath: id,
        error: error instanceof Error ? error.message : String(error),
        hint: await describeMissingPackage(missing, rootCwd),
        cause: error,
      }, { method: 'error' })
      // A config file is evaluated for its default export, so any failure is worth a second attempt
      const jiti = await getJiti(jitiCanHelp)
      if (!jiti) {
        if (missingPackage) {
          throw await missingPackageError(missingPackage)
        }
        if (!jitiCanHelp) {
          throw error
        }
        const diagnostic = missingGlobal ? configDiagnostics.NUXT_B5021 : configDiagnostics.NUXT_B5017
        throw diagnostic({
          filePath: id,
          error: error instanceof Error ? error.message : String(error),
          hint: describeNativeImportFailure(error),
          installCommand: await getAddDependencyCommand('jiti', rootCwd, { dev: true }),
          cause: error,
        }, { method: 'error' })
      }

      let loaded: unknown
      try {
        loaded = await jiti.import(id)
      } catch (jitiError) {
        if (missingPackage) {
          throw await missingPackageError(missingPackage)
        }
        // jiti's error is only the better one where jiti was expected to get further; a repeat of
        // the same failure keeps the native error and its untransformed stack
        const repeated = missingGlobal && getMissingCjsGlobal(jitiError) === missingGlobal
        throw jitiCanHelp && !repeated ? jitiError : error
      }

      jitiFallbacks.push({
        filePath: id,
        error: error instanceof Error ? error.message : String(error),
        hint: missingPackage ? await describeMissingPackage(missingPackage, rootCwd) : describeNativeImportFailure(error),
        missingPackage: !!missingPackage,
      })
      if (!missingPackage && isLoaderError(error)) {
        jitiImporter = id => jiti.import(id)
      }
      return loaded
    }
  }

  const loadRootConfig = () => withDefineNuxtConfig(
    () => loadConfig<NuxtConfig>({
      name: 'nuxt',
      configFile: configFileName,
      rcFile: opts.rcFile ?? '.nuxtrc',
      extend: { extendKey: ['theme', '_extends', 'extends'] },
      globalRc: opts.globalRc ?? true,
      merger: merger as (...sources: Array<NuxtConfig | null | undefined>) => NuxtConfig,
      cwd: opts.cwd,
      overrides: opts.overrides,
      defaults: opts.defaults,
      envName: opts.envName,
      import: opts.import ?? importConfigFile,
      dotenv: false, // already loaded above
      async resolve (source, resolveOptions) {
        // Respect a user-provided resolver
        const custom = await opts.resolve?.(source, resolveOptions)
        if (custom) { return custom as { config: NuxtConfig } }
        if (typeof source !== 'string') { return }
        // Fail early on a remote layer with no downloader, so the error names the project's own
        // package manager and the `package.json` alternative rather than the loader's generic hint
        if (REMOTE_SOURCE_RE.test(source)) {
          await assertRemoteLayerSupport(source, rootCwd)
        }
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
            configFile: configFileName,
            rcFile: false,
            extend: false,
            // Reuse the current load's importer so a nested layer is not loaded through a
            // second, differently configured one
            import: resolveOptions.import,
          })
          return layer.configFile
            ? { config: layer.config, configFile: layer.configFile, cwd: aliased, source: aliased, meta: layer.meta }
            : { config: {}, cwd: aliased, source }
        }
      },
    }),
  )

  const resolved = await loadRootConfig().catch(async (error) => {
    if (!isMissingConfbox(error)) {
      throw error
    }
    if (!await ensureDependencyInstalled('confbox', { rootDir: rootCwd, from: import.meta.url })) {
      throw configDiagnostics.NUXT_B5022({
        installCommand: await getAddDependencyCommand('confbox', rootCwd, { dev: true }),
        cause: error,
      }, { method: 'error' })
    }
    // The abandoned load already recorded the layers it reached, and a layer it has seen resolves
    // to an empty config on the way past
    seenLayerDirs.clear()
    extendsLocalLayerOrder.length = 0
    return loadRootConfig()
  })

  const { configFile, layers = [], cwd, meta } = resolved
  // schemas cannot be cloned, so they are replaced with their defaults first
  const runtimeConfigSchemas = extractRuntimeConfigSchemas(resolved.config.runtimeConfig)
  if (runtimeConfigSchemas.entries.length) {
    resolved.config.runtimeConfig = runtimeConfigSchemas.config as NuxtConfig['runtimeConfig']
  }
  const nuxtConfig = cloneConfig(resolved.config)

  // Merge of the layers c12 produced, minus the synthetic layer it creates for `overrides`, so
  // caller-supplied `overrides`/`defaults` never appear as user configuration. Taken before the
  // layer directories below are normalised, so schema defaults stay out of the snapshot.
  const rawConfig = opts.onConfigResolved
    ? merger({}, ...layers
      .filter(layer => layer.config && layer.config !== opts.overrides)
      .map(layer => layer.config!)) as NuxtConfig
    : undefined

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

  // the project `tsconfig.json` references the generated configurations by path, so they
  // have to keep being written where the project expects them even when we build
  // elsewhere. A `buildDir` supplied as an override (as test utilities do) is not what the
  // project references, so prefer the value the project configured for itself.
  nuxtConfig.typesDir ||= opts.overrides?.buildDir
    ? layers.find(l => l.config?.buildDir && l.config.buildDir !== opts.overrides?.buildDir)?.config?.buildDir || defaultBuildDir
    : nuxtConfig.buildDir || defaultBuildDir

  if (!opts.overrides?._prepare && !nuxtConfig.dev && !nuxtConfig.buildDir && existsSync(defaultBuildDir)) {
    nuxtConfig.buildDir = join(nuxtConfig.rootDir!, 'node_modules/.cache/nuxt/.nuxt')
  }

  const resolver = await resolverPromise

  const _layers: LoadedConfigLayer[] = []
  const processedLayers = new Set<string>()
  const localRelativePaths = new Set(localLayers.map(layer => layer.replace(/\/$/, '')))
  for (const layer of layers) {
    const layerCwd = layer.cwd
    // Bundler module ids are realpaths, so address extended layers by their symlink target
    if (layer.cwd && layer.cwd !== cwd) {
      layer.cwd = tryRealPath(layer.cwd)
      layer.configFile &&= tryRealPath(layer.configFile)
    }

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

    layer.config = await resolver.resolveLayerOptions(layer.config)

    if (!layer.configFile || layer.configFile.endsWith('.nuxtrc')) { continue }

    // Add layer name for local layers
    if (layerCwd && cwd && localRelativePaths.has(relative(cwd, layerCwd))) {
      layer.meta ||= {}
      layer.meta.name ||= basename(layerCwd)
    }

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

  const options = await resolver.resolveNuxtOptions(nuxtConfig)
  options._runtimeConfigSchemas = runtimeConfigSchemas.entries
  restoreRuntimeConfigSchemaNulls(options.runtimeConfig, runtimeConfigSchemas.config, runtimeConfigSchemas.entries)
  const nitroRuntimeConfig = (options.nitro as NitroConfig).runtimeConfig
  if (nitroRuntimeConfig) {
    restoreRuntimeConfigSchemaNulls(nitroRuntimeConfig, runtimeConfigSchemas.config, runtimeConfigSchemas.entries)
  }

  for (const { missingPackage, ...fallback } of jitiFallbacks) {
    if (shouldReportJitiFallbackOnce(fallback.filePath, options.rootDir, options.future.compatibilityVersion, missingPackage)) {
      configDiagnostics.NUXT_B5023({ ...fallback, installCommand: missingPackage ? undefined : await getAddDependencyCommand('jiti', rootCwd, { dev: true }) })
    }
  }

  if (opts.onConfigResolved) {
    await opts.onConfigResolved({
      rawConfig: rawConfig!,
      layers: _layers as NuxtConfigLayer[],
      configFile,
      cwd: cwd!,
    })
  }

  return options
}

/**
 * Copies the plain objects and arrays of a config, so that resolving options does not write
 * into the configs of its layers. Other values, and the entries of nested `plugins` arrays, are
 * kept by reference, as bundler plugins can depend on their identity and on symbol-keyed properties.
 */
function cloneConfig<T> (config: T): T {
  const copies = new WeakMap<object, unknown>()
  const pluginArrayCopies = new WeakMap<object, unknown>()
  const clone = (value: unknown, keepEntries: boolean): unknown => {
    if (!Array.isArray(value) && !isPlainObject(value)) {
      return value
    }
    const cache = Array.isArray(value) && keepEntries ? pluginArrayCopies : copies
    if (cache.has(value)) {
      return cache.get(value)
    }
    if (Array.isArray(value)) {
      const copy: unknown[] = []
      cache.set(value, copy)
      for (const entry of value) {
        copy.push(keepEntries && !Array.isArray(entry) ? entry : clone(entry, keepEntries))
      }
      return copy
    }
    const copy = Object.create(Object.getPrototypeOf(value))
    copies.set(value, copy)
    for (const key of Reflect.ownKeys(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) {
        Object.defineProperty(copy, key, { value: clone(value[key], value !== config && key === 'plugins'), enumerable: true, writable: true, configurable: true })
      }
    }
    return copy
  }
  return clone(config, false) as T
}

function isPlainObject (value: unknown): value is Record<PropertyKey, unknown> {
  if (!value || typeof value !== 'object') {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Canonicalise a filesystem path to a layer directory: config-file paths collapse to their
 * directory and symlinks resolve to their target, so different spellings of the same layer
 * share one identity. The path must exist.
 */
function canonicalLayerDir (path: string): string {
  return normalize(realpathSync(statSync(path).isDirectory() ? path : dirname(path)))
}

function tryRealPath (path: string): string {
  try {
    return normalize(realpathSync(path))
  } catch {
    return path
  }
}

function withTrailingSlash (path: string | undefined): string {
  if (!path) {
    return '/'
  }
  return path.endsWith('/') ? path : `${path}/`
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
  layers: LoadedConfigLayer[],
  extendsOrder: string[],
  localLayerDirs: Set<string>,
) {
  const layerDir = (layer: LoadedConfigLayer) => normalize(tryRealPath((layer.config?.rootDir ?? layer.cwd ?? '').replace(/\/$/, '')))

  const priorityByDir = new Map(extendsOrder.map((dir, index) => [dir, index]))

  const localSlots: number[] = []
  const localLayers: LoadedConfigLayer[] = []
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

interface OptionsResolver {
  resolveNuxtOptions: (config: NuxtConfig) => NuxtOptions | Promise<NuxtOptions>
  resolveLayerOptions: (config: NuxtConfig) => NuxtConfig | Promise<NuxtConfig>
}

const LAYER_SCHEMA_KEYS = ['srcDir', 'rootDir', 'serverDir', 'dir']

/**
 * Load the options resolver of the Nuxt version installed in `cwd`, falling back to the one
 * installed alongside kit. Nuxt 3 and 4 have no resolver, so their `@nuxt/schema` defaults are
 * applied instead.
 */
async function loadOptionsResolver (cwd: string): Promise<OptionsResolver> {
  for (const from of [directoryToURL(cwd), import.meta.url]) {
    for (const name of ['nuxt', 'nuxt-nightly']) {
      const resolver = await loadOptionsResolverFrom(name, from)
      if (resolver) {
        return resolver
      }
    }
  }
  throw kitDiagnostics.NUXT_B8006({ cwd, installCommand: await getAddDependencyCommand('nuxt', cwd) }, { method: 'error' })
}

async function loadOptionsResolverFrom (name: string, from: URL | string): Promise<OptionsResolver | undefined> {
  const configPath = resolveModuleURL(`${name}/config`, { try: true, from })
  if (!configPath) {
    return
  }
  const config = await import(configPath) as Partial<OptionsResolver>
  if (config.resolveNuxtOptions && config.resolveLayerOptions) {
    return config as OptionsResolver
  }
  const schemaPath = resolveModuleURL('@nuxt/schema', { try: true, from: [configPath, from] })
  const schema: InputObject | undefined = schemaPath ? (await import(schemaPath)).NuxtConfigSchema : undefined
  if (!schema) {
    return
  }
  const layerSchema: InputObject = Object.create(null)
  for (const key of LAYER_SCHEMA_KEYS) {
    if (key in schema) {
      layerSchema[key] = schema[key]
    }
  }
  return {
    resolveNuxtOptions: config => applyDefaults(schema, config as NuxtConfig & Record<string, JSValue>) as unknown as Promise<NuxtOptions>,
    resolveLayerOptions: config => applyDefaults(layerSchema, config as NuxtConfig & Record<string, JSValue>) as unknown as Promise<NuxtConfig>,
  }
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
