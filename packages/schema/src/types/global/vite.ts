/**
 * Reference: https://github.com/vitejs/vite/blob/main/packages/vite/types/importMeta.d.ts
 */
export interface ViteImportMeta {
  /** Vite client HMR API - see https://vitejs.dev/guide/api-hmr.html */
  readonly hot?: import('vite/types/hot').ViteHotContext

  /** vite glob import utility - https://vitejs.dev/guide/features.html#glob-import */
  glob: import('vite/types/importGlob').ImportGlobFunction

  /**
   * @deprecated Use `import.meta.glob('*', { eager: true })` instead
   */
  globEager: import('vite/types/importGlob').ImportGlobEagerFunction
}
