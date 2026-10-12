import { HookableCore } from 'hookable'
import plugins from 'nuxt/internal/renderer-plugins'

import type { NuxtServerRendererHooks } from '../../../server/hooks'
import { createBuildFiles } from './build-files'
import type { BuildFiles } from './build-files'
import type { NuxtRendererOptions, RendererHooks } from './runtime'

/**
 * A renderer created for one set of {@link NuxtRendererOptions}, owning every piece of
 * state a render reads. Nothing is held at module scope, so several renderers can coexist
 * in one bundle.
 */
export interface NuxtRendererInstance extends BuildFiles {
  /** The capabilities the surrounding server runtime provided. */
  readonly options: NuxtRendererOptions
  /** The hooks of the renderer plugins, followed by those the server runtime exposes. */
  readonly hooks: RendererHooks
}

/**
 * Create the renderer state for a set of options, calling each renderer plugin with the
 * hooks of the new renderer.
 *
 * Called by `createNuxtRenderer()`; call it directly only to render against the same
 * artifacts as a renderer created elsewhere (an island handler sharing the server bundle
 * loaded for page renders), and pass the result to `createNuxtRenderer()`.
 */
export function createRendererInstance (options: NuxtRendererOptions): NuxtRendererInstance {
  return {
    options,
    hooks: createRendererHooks(options),
    ...createBuildFiles(options),
  }
}

function createRendererHooks (options: NuxtRendererOptions): RendererHooks {
  if (!plugins.length) {
    return { callHook: (name, ...args) => options.hooks().callHook(name, ...args) }
  }

  const own = new HookableCore<NuxtServerRendererHooks>()
  const context = { hooks: { hook: own.hook.bind(own) } }
  for (const plugin of plugins) {
    plugin(context)
  }

  return {
    callHook (name, ...args) {
      const result = own.callHook(name, ...args)
      if (result instanceof Promise) {
        return result.then(() => options.hooks().callHook(name, ...args))
      }
      return options.hooks().callHook(name, ...args)
    },
  }
}
