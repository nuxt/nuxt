import type { NuxtOptions } from '@nuxt/schema'

export function getNuxtEnvName (options: Pick<NuxtOptions, 'dev' | '_loadOptions'>): string {
  return typeof options._loadOptions?.envName === 'string'
    ? options._loadOptions.envName
    : (options.dev ? 'development' : 'production')
}
