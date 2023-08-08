import type { KeepAliveProps, TransitionProps } from 'vue'
import type { ConfigSchema } from '../../schema/config'
import type { ServerOptions as ViteServerOptions, UserConfig as ViteUserConfig } from 'vite'
import type { Options as VuePluginOptions } from '@vitejs/plugin-vue'
import type { Options as VueJsxPluginOptions } from '@vitejs/plugin-vue-jsx'
import type { AppHeadMetaObject } from './head'
import type { Nuxt } from './nuxt'
import type { SchemaDefinition } from 'untyped'
import type { NitroRuntimeConfig, NitroRuntimeConfigApp } from 'nitropack'
export type { SchemaDefinition } from 'untyped'

type DeepPartial<T> = T extends Function ? T : T extends Record<string, any> ? { [P in keyof T]?: DeepPartial<T[P]> } : T

type ExtractUpperChunk<T extends string> = T extends `${infer A}${infer B}`
  ? A extends Uppercase<A>
    ? B extends `${Uppercase<string>}${infer Rest}`
      ? B extends `${infer C}${Rest}`
        ? `${A}${C}${ExtractUpperChunk<Rest>}`
        : never
      : A
    : ''
  : never

type SliceLast<T extends string> = T extends `${infer A}${infer B}`
  ? B extends `${infer C}${infer D}`
    ? D extends ''
      ? A
      : `${A}${C}${SliceLast<D>}`
    : ''
  : never

type UpperSnakeCase<T extends string, State extends 'start' | 'lower' | 'upper' = 'start'> = T extends `${infer A}${infer B}`
  ? A extends Uppercase<A>
    ? A extends `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0}`
      ? `${A}${UpperSnakeCase<B, 'lower'>}`
      : State extends 'lower' | 'upper'
        ? B extends `${SliceLast<ExtractUpperChunk<B>>}${infer Rest}`
          ? SliceLast<ExtractUpperChunk<B>> extends ''
            ? `_${A}_${UpperSnakeCase<B, 'start'>}`
            : `_${A}${SliceLast<ExtractUpperChunk<B>>}_${UpperSnakeCase<Rest, 'start'>}`
          : B extends Uppercase<B>
            ? `_${A}${B}`
            : `_${A}${UpperSnakeCase<B, 'lower'>}`
        : State extends 'start'
          ? `${A}${UpperSnakeCase<B, 'lower'>}`
          : never
      : State extends 'start' | 'lower'
        ? `${Uppercase<A>}${UpperSnakeCase<B, 'lower'>}`
        : `_${Uppercase<A>}${UpperSnakeCase<B, 'lower'>}`
  : Uppercase<T>

const message = Symbol('message')
export type RuntimeValue<T, B extends string> = T & { [message]?: B }
type Overrideable<T extends Record<string, any>, Path extends string = ''> = {
  [K in keyof T]?: K extends string
    ? unknown extends T[K]
      ? unknown
      : T[K] extends Record<string, unknown>
        ? RuntimeValue<Overrideable<T[K], `${Path}_${UpperSnakeCase<K>}`>, `You can override this value at runtime with NUXT${Path}_${UpperSnakeCase<K>}`>
        : RuntimeValue<T[K], `You can override this value at runtime with NUXT${Path}_${UpperSnakeCase<K>}`>
      : K extends number
        ? T[K]
        : never
}

/** User configuration in `nuxt.config` file */
export interface NuxtConfig extends DeepPartial<Omit<ConfigSchema, 'vite' | 'runtimeConfig'>> {
  // Avoid DeepPartial for vite config interface (#4772)
  vite?: ConfigSchema['vite']
  runtimeConfig?: Overrideable<RuntimeConfig>
  webpack?: DeepPartial<ConfigSchema['webpack']> & {
    $client?: DeepPartial<ConfigSchema['webpack']>
    $server?: DeepPartial<ConfigSchema['webpack']>
  }

  /**
   * Experimental custom config schema
   *
   * @see https://github.com/nuxt/nuxt/issues/15592
  */
  $schema?: SchemaDefinition
}

// TODO: Expose ConfigLayer<T> from c12
interface ConfigLayer<T> {
  config: T
  cwd: string
  configFile: string
}
export type NuxtConfigLayer = ConfigLayer<NuxtConfig & {
  srcDir: ConfigSchema['srcDir'],
  rootDir: ConfigSchema['rootDir']
}>

/** Normalized Nuxt options available as `nuxt.options.*` */
export interface NuxtOptions extends Omit<ConfigSchema, 'builder' | 'webpack'> {
  sourcemap: Required<Exclude<ConfigSchema['sourcemap'], boolean>>
  builder: '@nuxt/vite-builder' | '@nuxt/webpack-builder' | { bundle: (nuxt: Nuxt) => Promise<void> }
  webpack: ConfigSchema['webpack'] & {
    $client: ConfigSchema['webpack']
    $server: ConfigSchema['webpack']
  }
  _layers: NuxtConfigLayer[]
  $schema: SchemaDefinition
}

export interface ViteConfig extends Omit<ViteUserConfig, 'publicDir'> {
  /** The path to the entrypoint for the Vite build. */
  entry?: string
  /**
   * Options passed to @vitejs/plugin-vue.
   * @see https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue
   */
  vue?: VuePluginOptions

  /**
   * Options passed to @vitejs/plugin-vue-jsx.
   * @see https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue-jsx
   */
  vueJsx?: VueJsxPluginOptions

  /**
   * Bundler for dev time server-side rendering.
   * @default 'vite-node'
   */
  devBundler?: 'vite-node' | 'legacy'

  /**
   * Warmup vite entrypoint caches on dev startup.
   */
  warmupEntry?: boolean

  /**
   * Use environment variables or top level `server` options to configure Nuxt server.
   */
  server?: Omit<ViteServerOptions, 'port' | 'host'>
  /**
   * Directly configuring the `vite.publicDir` option is not supported. Instead, set `dir.public`.
   *
   * You can read more in <https://nuxt.com/docs/api/configuration/nuxt-config#public>.
   *
   * @deprecated
   */
  publicDir?: never
}


// -- Runtime Config --

type RuntimeConfigNamespace = Record<string, unknown>

export interface PublicRuntimeConfig extends RuntimeConfigNamespace { }

export interface RuntimeConfig extends RuntimeConfigNamespace {
  app: NitroRuntimeConfigApp
  /** Only available on the server. */
  nitro?: NitroRuntimeConfig['nitro']
  public: PublicRuntimeConfig
}

// -- App Config --

export interface CustomAppConfig {
  [key: string]: unknown
}

export interface AppConfigInput extends CustomAppConfig {
  /** @deprecated reserved */
  private?: never
  /** @deprecated reserved */
  nuxt?: never
  /** @deprecated reserved */
  nitro?: never
  /** @deprecated reserved */
  server?: never
}

export interface NuxtAppConfig {
  head: AppHeadMetaObject
  layoutTransition: boolean | TransitionProps
  pageTransition: boolean | TransitionProps
  keepalive: boolean | KeepAliveProps
}

export interface AppConfig {
  [key: string]: unknown
}
