import { createBuildFiles } from './build-files'
import type { BuildFiles } from './build-files'
import type { NuxtRendererOptions } from './runtime'

/**
 * A renderer created for one set of {@link NuxtRendererOptions}, owning every piece of
 * state a render reads. Nothing is held at module scope, so several renderers can coexist
 * in one bundle.
 */
export interface NuxtRendererInstance extends BuildFiles {
  /** The capabilities the surrounding server runtime provided. */
  readonly options: NuxtRendererOptions
}

/**
 * Create the renderer state for a set of options.
 *
 * Called by `createNuxtRenderer()`; call it directly only to render against the same
 * artifacts as a renderer created elsewhere (an island handler sharing the server bundle
 * loaded for page renders), and pass the result to `createNuxtRenderer()`.
 */
export function createRendererInstance (options: NuxtRendererOptions): NuxtRendererInstance {
  return {
    options,
    ...createBuildFiles(options),
  }
}
