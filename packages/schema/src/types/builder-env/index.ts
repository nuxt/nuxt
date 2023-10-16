import type { ViteImportMeta } from './vite'
import type { WebpackImportMeta } from './webpack'

export type BundlerImportMeta = ViteImportMeta & WebpackImportMeta

declare global {
  interface ImportMeta extends BundlerImportMeta {
    /** the `file:` url of the current file (similar to `__filename` but as file url) */
    url: string

    readonly env: Record<string, string | boolean | undefined>
  }
}
