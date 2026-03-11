import type { NuxtModule } from './module.ts'

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
  /** Debug for production hydration mismatch */
  hydration?: boolean
  /** Debug for Vue Router */
  router?: boolean
  /** Debug for hooks, can be set to `true` or an object with `server` and `client` keys */
  hooks?: boolean | {
    server?: boolean
    client?: boolean
  }
  /**
   * Profile startup/build performance.
   *
   * - `true` — full report printed to console, JSON + `.cpuprofile` written on exit
   * - `'quiet'` — JSON + `.cpuprofile` written on exit with no console output
   *
   * Activated via `nuxi dev --profile=verbose`, `nuxi dev --profile` (quiet),
   * `NUXT_DEBUG_PERF=1` (or `=quiet`), or `debug: { perf: true }` in nuxt.config.
   * @since 4.4.0
   */
  perf?: boolean | 'quiet'
}
