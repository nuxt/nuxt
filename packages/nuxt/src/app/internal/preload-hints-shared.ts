// read by the build, the renderer and the client, each built on its own, so this module imports nothing

/** The key a loader's chunks are hinted under, or `false` on the loader of a server page, which a prefetch has to run. */
export const PRELOAD_MODULE_KEY = '__nuxt_module'

/** Where the renderer serves the hints of route components, under the app's base URL. */
export const PAGE_HINTS_PREFIX = '/__nuxt_preload/'

export interface PreloadHint {
  rel: 'modulepreload' | 'preload'
  as?: 'script' | 'style'
  /** The file within the build assets, not its URL. */
  file: string
  /** Requested without `crossorigin`, as the client build loads it. */
  noCors?: true
}

/** Indices into `files`, so a chunk shared by several modules is listed once. */
export interface ChunkHints {
  files: PreloadHint[]
  chunks: Record<string, number[]>
}
