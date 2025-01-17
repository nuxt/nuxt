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
