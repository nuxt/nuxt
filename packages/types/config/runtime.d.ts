/**
* NuxtOptionsRuntimeConfig
* NuxtRuntimeConfig interface can be extended by users to enable intellisense on $config
*/

export interface NuxtRuntimeConfig {
  [key: string]: any
}

export type NuxtOptionsRuntimeConfig = NuxtRuntimeConfig | ((env: typeof process.env) => NuxtRuntimeConfig)
