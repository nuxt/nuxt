/**
* NuxtConfigurationRuntimeConfig
* NuxtRuntimeConfig interface can be extended by users to enable intellisense on $config
*/

export interface NuxtRuntimeConfig {
  [key: string]: any
}

export type NuxtConfigurationRuntimeConfig = NuxtRuntimeConfig | ((env: typeof process.env) => NuxtRuntimeConfig)
