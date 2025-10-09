import type { ViteConfig } from 'nuxt/schema'

export { bundle } from './vite'

declare module 'nuxt/schema' {
  interface ViteOptions extends ViteConfig {
    $client?: ViteConfig
    $server?: ViteConfig
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
