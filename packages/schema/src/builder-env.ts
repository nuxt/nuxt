import type { BundlerImportMeta } from './types/builder-env/index.ts'

declare global {
  interface ImportMetaEnv {
    [key: string]: any
  }

  interface ImportMeta extends BundlerImportMeta {
    /** the `file:` url of the current file (similar to `__filename` but as file url) */
    url: string

    readonly env: ImportMetaEnv
  }
}

export const builders = ['vite', 'webpack'] as const
