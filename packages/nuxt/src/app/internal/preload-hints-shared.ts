// read by the build, the renderer and the client, each built on its own, so this module imports nothing

/** The key a loader's chunks are hinted under, or `false` on the loader of a server page, which a prefetch has to run. */
export const PRELOAD_MODULE_KEY = '__nuxt_module'

export const HINTS_PREFIX = '/__nuxt_preload/'

export interface PreloadHint {
  rel: 'modulepreload' | 'preload'
  as?: 'script' | 'style'
  /** The file within the build assets, not its URL. */
  file: string
  /** Requested without `crossorigin`, as the client build loads it. */
  noCors?: true
}

export interface RouteChunkHints {
  files: PreloadHint[]
  layouts: Record<string, number[]>
  /** Keyed by the value of {@link PRELOAD_MODULE_KEY} on the loader of the route component. */
  pages: Record<string, number[]>
}
