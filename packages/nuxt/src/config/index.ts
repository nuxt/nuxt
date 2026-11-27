import type { NuxtConfig } from '@nuxt/schema'

export { resolveLayerOptions, resolveNuxtOptions } from './resolve/index.ts'
export { template as loadingTemplate } from './templates/loading.ts'

export function defineNuxtConfig (config: NuxtConfig): NuxtConfig {
  return config
}
