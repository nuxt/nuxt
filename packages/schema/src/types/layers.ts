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
