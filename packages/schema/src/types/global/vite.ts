/**
 * Reference: https://github.com/vitejs/vite/blob/main/packages/vite/types/importMeta.d.ts
 */

export interface ViteHot {
  readonly data: any

  accept (): void
  accept (cb: (mod: any) => void): void
  accept (dep: string, cb: (mod: any) => void): void
  accept (deps: readonly string[], cb: (mods: any[]) => void): void

  dispose (cb: (data: any) => void): void
  decline (): void
  invalidate (): void

  on (event: any, cb: (payload: any) => void): void
  send (event: any, data?: any): void
}

export interface ViteGlobOptions {
  as?: string
  eager?: boolean
  import?: string
  query?: string | Record<string, string | number | boolean>
  exhaustive?: boolean
}

export interface ViteImportMeta {
  /** Vite client HMR API - see https://vitejs.dev/guide/api-hmr.html */
  readonly hot?: ViteHot

  /** vite glob import utility - https://vitejs.dev/guide/features.html#glob-import */
  glob (glob: string | string[], options?: ViteGlobOptions): Record<string, () => Promise<Record<string, any>>>
}
