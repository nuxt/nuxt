import type { KeepAliveProps, TransitionProps } from 'vue'
import type { ServerOptions as ViteServerOptions, UserConfig as ViteUserConfig } from 'vite'
import type { Options as VuePluginOptions } from '@vitejs/plugin-vue'
import type { Options as VueJsxPluginOptions } from '@vitejs/plugin-vue-jsx'
import type { SchemaDefinition } from 'untyped'
import type { NitroRuntimeConfig, NitroRuntimeConfigApp } from 'nitro/types'
import type { SnakeCase } from 'scule'
import type { ConfigSchema } from '../../schema/config'
import type { Nuxt } from './nuxt'
import type { AppHeadMetaObject } from './head'

export type { SchemaDefinition } from 'untyped'

type DeepPartial<T> = T extends Function ? T : T extends Record<string, any> ? { [P in keyof T]?: DeepPartial<T[P]> } : T

export type UpperSnakeCase<S extends string> = Uppercase<SnakeCase<S>>

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

// Runtime Config

type RuntimeConfigNamespace = Record<string, unknown>

export interface PublicRuntimeConfig extends RuntimeConfigNamespace { }

export interface RuntimeConfig extends RuntimeConfigNamespace {
  app: NitroRuntimeConfigApp
  /** Only available on the server. */
  nitro?: NitroRuntimeConfig['nitro']
  public: PublicRuntimeConfig
}

// User configuration in `nuxt.config` file
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
   * @see [Nuxt Issue #15592](https://github.com/nuxt/nuxt/issues/15592)
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
  srcDir: ConfigSchema['srcDir']
  rootDir: ConfigSchema['rootDir']
}>

export interface NuxtBuilder {
  bundle: (nuxt: Nuxt) => Promise<void>
}

// Normalized Nuxt options available as `nuxt.options.*`
export interface NuxtOptions extends Omit<ConfigSchema, 'builder' | 'webpack' | 'postcss'> {
  sourcemap: Required<Exclude<ConfigSchema['sourcemap'], boolean>>
  builder: '@nuxt/vite-builder' | '@nuxt/webpack-builder' | NuxtBuilder
  postcss: Omit<ConfigSchema['postcss'], 'order'> & { order: Exclude<ConfigSchema['postcss']['order'], string> }
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
   * @see [@vitejs/plugin-vue](https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue)
   */
  vue?: VuePluginOptions

  /**
   * Options passed to @vitejs/plugin-vue-jsx.
   * @see [@vitejs/plugin-vue-jsx.](https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue-jsx)
   */
  vueJsx?: VueJsxPluginOptions

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
   * You can read more in <https://nuxt.com/docs/api/nuxt-config#public>.
   * @deprecated
   */
  publicDir?: never
}

// App Config
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

type Serializable<T> = T extends Function ? never : T extends Promise<infer U> ? Serializable<U> : T extends string & {} ? T : T extends Record<string, any> ? { [K in keyof T]: Serializable<T[K]> } : T

export interface NuxtAppConfig {
  head: Serializable<AppHeadMetaObject>
  layoutTransition: boolean | Serializable<TransitionProps>
  pageTransition: boolean | Serializable<TransitionProps>
  viewTransition?: boolean | 'always'
  keepalive: boolean | Serializable<KeepAliveProps>
}

export interface AppConfig {
  [key: string]: unknown
}
