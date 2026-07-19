import type { ViteConfig } from 'nuxt/schema'
import type { EnvironmentOptions } from 'vite'

export { bundle } from './vite.ts'
export { setupWatcher } from './watcher.ts'

declare module 'nuxt/schema' {
  interface ViteOptions extends ViteConfig {
    $client?: EnvironmentOptions
    $server?: EnvironmentOptions
    viteNode?: {
      maxRetryAttempts?: number
      /** in milliseconds */
      baseRetryDelay?: number
      /** in milliseconds */
      maxRetryDelay?: number
      /** in milliseconds */
      requestTimeout?: number
    }
  }
}
