/** A single entry in the client build manifest. */
export interface NuxtManifestResource {
  /** Source module the chunk was built from. */
  src?: string
  /** Emitted filename, relative to the build assets directory. */
  file: string
  /** Stylesheets emitted alongside the chunk. */
  css?: string[]
  /** Other assets emitted alongside the chunk. */
  assets?: string[]
  isEntry?: boolean
  name?: string
  isDynamicEntry?: boolean
  sideEffects?: boolean
  imports?: string[]
  dynamicImports?: string[]
  /** Whether the resource is an ES module. */
  module?: boolean
  /** Emit a `prefetch` resource hint for this resource. */
  prefetch?: boolean
  /** Emit a `preload` resource hint for this resource. */
  preload?: boolean
  resourceType?: 'audio' | 'document' | 'embed' | 'fetch' | 'font' | 'image' | 'object' | 'script' | 'style' | 'track' | 'worker' | 'video'
  mimeType?: string
}

/** The client build manifest, used to render resource hints and resolve module dependencies. */
export interface NuxtManifest {
  [key: string]: NuxtManifestResource
}
