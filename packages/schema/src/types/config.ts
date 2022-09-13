import type { KeepAliveProps, TransitionProps } from 'vue'
import { ConfigSchema } from '../../schema/config'
import type { UserConfig as ViteUserConfig } from 'vite'
import type { Options as VuePluginOptions } from '@vitejs/plugin-vue'
import type { MetaObject } from './meta'
import type { Nuxt } from './nuxt'

type DeepPartial<T> = T extends Function ? T : T extends Record<string, any> ? { [P in keyof T]?: DeepPartial<T[P]> } : T

/** User configuration in `nuxt.config` file */
export interface NuxtConfig extends DeepPartial<Omit<ConfigSchema, 'vite'>> {
  // Avoid DeepPartial for vite config interface (#4772)
  vite?: ConfigSchema['vite']
  [key: string]: any
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
export interface NuxtOptions extends Omit<ConfigSchema, 'builder'> {
  sourcemap: Required<Exclude<ConfigSchema['sourcemap'], boolean>>
  builder: '@nuxt/vite-builder' | '@nuxt/webpack-builder' | { bundle: (nuxt: Nuxt) => Promise<void> }
  _layers: NuxtConfigLayer[]
}

export interface ViteConfig extends ViteUserConfig {
  /**
   * Options passed to @vitejs/plugin-vue
   * @see https://github.com/vitejs/vite/tree/main/packages/plugin-vue
   */
  vue?: VuePluginOptions

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
  server?: never
}


// -- Runtime Config --

type RuntimeConfigNamespace = Record<string, any>

export interface PublicRuntimeConfig extends RuntimeConfigNamespace {}

// TODO: remove before release of 3.0.0
/** @deprecated use RuntimeConfig interface */
export interface PrivateRuntimeConfig extends RuntimeConfigNamespace {}

export interface RuntimeConfig extends PrivateRuntimeConfig, RuntimeConfigNamespace {
  public: PublicRuntimeConfig
}

// -- App Config --
export interface AppConfigInput extends Record<string, any> {
  /** @deprecated reserved */
  private?: never
  /** @deprecated reserved */
  nuxt?: never
  /** @deprecated reserved */
  nitro?: never
}

export interface NuxtAppConfig {
  head: MetaObject
  layoutTransition: boolean | TransitionProps
  pageTransition: boolean | TransitionProps
  keepalive: boolean | KeepAliveProps
}

export interface AppConfig {}
