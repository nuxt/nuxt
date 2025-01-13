export interface NuxtDebugContext {
  /**
   * Module mutation records to the `nuxt` instance.
   */
  moduleMutationRecords?: NuxtDebugModuleMutationRecord[]
}

export interface NuxtDebugModuleMutationRecord {
  module: string | undefined
  keys: (string | symbol)[]
  value: any
  method?: string
  timestamp: number
}
