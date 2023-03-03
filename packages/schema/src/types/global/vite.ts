/**
 * Reference: https://github.com/vitejs/vite/blob/main/packages/vite/types/importMeta.d.ts
 */
export type ModuleNamespace = Record<string, any> & {
  [Symbol.toStringTag]: 'Module'
}

export interface ViteHot {
  readonly data: any

  accept (): void
  accept (cb: (mod: ModuleNamespace | undefined) => void): void
  accept (dep: string, cb: (mod: ModuleNamespace | undefined) => void): void
  accept (deps: readonly string[], cb: (mods: Array<ModuleNamespace | undefined>) => void): void
  acceptExports (exportNames: string | readonly string[], cb?: (mod: ModuleNamespace | undefined) => void): void

  dispose (cb: (data: any) => void): void
  prune (cb: (data: any) => void): void
  invalidate (message?: string): void

  on (event: any, cb: (payload: any) => void): void
  send (event: any, data?: any): void
}

export interface KnownAsTypeMap {
  raw: string
  url: string
  worker: Worker
}

export interface ImportGlobOptions<
  Eager extends boolean,
  AsType extends string
> {
  /**
   * Import type for the import url.
   */
  as?: AsType
  /**
   * Import as static or dynamic
   *
   * @default false
   */
  eager?: Eager
  /**
   * Import only the specific named export. Set to `default` to import the default export.
   */
  import?: string
  /**
   * Custom queries
   */
  query?: string | Record<string, string | number | boolean>
  /**
   * Search files also inside `node_modules/` and hidden directories (e.g. `.git/`). This might have impact on performance.
   *
   * @default false
   */
  exhaustive?: boolean
}

export interface ImportGlobFunction {
  /**
   * Import a list of files with a glob pattern.
   *
   * Overload 1: No generic provided, infer the type from `eager` and `as`
   */
  <
    Eager extends boolean,
    As extends string,
    T = As extends keyof KnownAsTypeMap ? KnownAsTypeMap[As] : unknown
  >(
    glob: string | string[],
    options?: ImportGlobOptions<Eager, As>
  ): (Eager extends true
  ? true
  : false) extends true
    ? Record<string, T>
    : Record<string, () => Promise<T>>
  /**
   * Import a list of files with a glob pattern.
   *
   * Overload 2: Module generic provided, infer the type from `eager: false`
   */
  <M>(
    glob: string | string[],
    options?: ImportGlobOptions<false, string>
  ): Record<string, () => Promise<M>>
  /**
   * Import a list of files with a glob pattern.
   *
   * Overload 3: Module generic provided, infer the type from `eager: true`
   */
  <M>(
    glob: string | string[],
    options: ImportGlobOptions<true, string>
  ): Record<string, M>
}

export interface ImportGlobEagerFunction {
  /**
   * Eagerly import a list of files with a glob pattern.
   *
   * Overload 1: No generic provided, infer the type from `as`
   */
  <
    As extends string,
    T = As extends keyof KnownAsTypeMap ? KnownAsTypeMap[As] : unknown
  >(
    glob: string | string[],
    options?: Omit<ImportGlobOptions<boolean, As>, 'eager'>
  ): Record<string, T>
  /**
   * Eagerly import a list of files with a glob pattern.
   *
   * Overload 2: Module generic provided
   */
  <M>(
    glob: string | string[],
    options?: Omit<ImportGlobOptions<boolean, string>, 'eager'>
  ): Record<string, M>
}

export interface ViteImportMeta {
  /** Vite client HMR API - see https://vitejs.dev/guide/api-hmr.html */
  readonly hot?: ViteHot

  /** vite glob import utility - https://vitejs.dev/guide/features.html#glob-import */
  glob: ImportGlobFunction

  /**
   * @deprecated Use `import.meta.glob('*', { eager: true })` instead
   */
  globEager: ImportGlobEagerFunction
}
