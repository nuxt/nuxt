/**
* NuxtOptionsRuntimeConfig
* NuxtRuntimeConfig interface can be extended by users to enable intellisense on $config
*/

export interface NuxtRuntimeConfig {
  [key: string]: any;
  /**
   * This is used internally by Nuxt for dynamic configuration and should not be used.
   * @internal
   */
  _app?: never;
}

export type NuxtOptionsRuntimeConfig = NuxtRuntimeConfig | ((env: typeof process.env) => NuxtRuntimeConfig)
