import type { NitroOptions } from 'nitro/types'

export interface NuxtDebugOptions {
  templates?: boolean
  modules?: boolean
  watchers?: boolean
  nitro?: NitroOptions['debug']
  hydration?: boolean
  router?: boolean
  hooks?: boolean | {
    server?: boolean
    client?: boolean
  }
}
