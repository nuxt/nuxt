import type { NuxtConfig } from './config.ts'
import type { ConfigSchema } from './schema.ts'

/**
 * Metadata describing a config layer, taken from the `$meta` key of its `nuxt.config`.
 *
 * A layer's `name` is used to register the `#layers/<name>` alias.
 */
export interface NuxtConfigLayerMeta {
  name?: string
  [key: string]: any
}

/**
 * Options for a single entry in `extends`, supplied as the second element of a tuple:
 *
 * ```ts
 * export default defineNuxtConfig({
 *   extends: [['github:my-org/my-theme', { auth: process.env.GITHUB_TOKEN }]],
 * })
 * ```
 */
export interface NuxtLayerSourceOptions {
  /** Metadata to attach to the resolved layer, merged over the layer's own `$meta`. */
  meta?: NuxtConfigLayerMeta
  /** Configuration applied on top of the layer's own configuration. */
  overrides?: NuxtConfig
  /** Install the layer's dependencies after cloning a remote source. */
  install?: boolean
  /** Token used to clone a private remote source. */
  auth?: string
  [key: string]: any
}

/** Options controlling how `.env` files are loaded into `process.env` before config resolution. */
export interface NuxtDotenvOptions {
  /** Directory to resolve `.env` files from. Defaults to the config loading `cwd`. */
  cwd?: string
  /**
   * File or files to read environment variables from, relative to `cwd`.
   *
   * With an array, later entries override earlier ones.
   * @default '.env'
   */
  fileName?: string | string[]
  /**
   * Interpolate `${VAR}` references within `.env` values.
   * @default true
   */
  interpolate?: boolean
  /** Object to read from and write resolved variables into. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv
  /**
   * Resolve `_FILE`-suffixed variables by reading the file they point at and assigning its
   * trimmed contents to the base key, for container secrets mounted as files.
   * @default false
   */
  expandFileReferences?: boolean
}

/**
 * A single resolved configuration layer, as found in `nuxt.options._layers`.
 *
 * Layers are ordered highest priority first, with the root project itself as the first entry.
 */
export interface NuxtConfigLayer {
  /** The layer's own configuration, with its directory options resolved to absolute paths. */
  config: NuxtConfig & {
    srcDir: ConfigSchema['srcDir']
    rootDir: ConfigSchema['rootDir']
  }
  /** Absolute path of the directory the layer was loaded from. */
  cwd: string
  /** Absolute path of the layer's `nuxt.config` file. */
  configFile: string
  /** The `extends` entry this layer was resolved from, if it came from one. */
  source?: string
  /** Options supplied alongside `source` in `extends`. */
  sourceOptions?: NuxtLayerSourceOptions
  /** The layer's `$meta`. */
  meta?: NuxtConfigLayerMeta
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

/** Options for loading `nuxt.config` and its layers with `loadNuxtConfig` from `@nuxt/kit`. */
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
