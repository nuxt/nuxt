import type { ViteImportMeta } from './vite.ts'
import type { WebpackImportMeta } from './webpack.ts'

export type BundlerImportMeta = ViteImportMeta & WebpackImportMeta
