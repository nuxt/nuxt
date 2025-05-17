import type { NitroOptions } from 'nitro/types'
import type { NuxtModule } from './module'

export interface NuxtDebugContext {
  /**
   * Module mutation records to the `nuxt` instance.
   */
  moduleMutationRecords?: NuxtDebugModuleMutationRecord[]
}

export interface NuxtDebugModuleMutationRecord {
  module: NuxtModule
  keys: (string | symbol)[]
  target: 'nuxt.options'
  value: any
  method?: string
  timestamp: number
}

export interface NuxtDebugOptions {
  /** Debug for Nuxt templates */
  templates?: boolean
  /** Debug for modules setup timings */
  modules?: boolean
  /** Debug for file watchers */
  watchers?: boolean
  /** Debug options for Nitro */
  nitro?: NitroOptions['debug']
  /** Debug for production hydration mismatch */
  hydration?: boolean
  /** Debug for Vue Router */
  router?: boolean
  /** Debug for hooks, can be set to `true` or an object with `server` and `client` keys */
  hooks?: boolean | {
    server?: boolean
    client?: boolean
  }
}
