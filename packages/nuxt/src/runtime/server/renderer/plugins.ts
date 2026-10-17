import { HookableCore } from 'hookable'
import plugins from 'nuxt/internal/renderer-plugins'

import type { NuxtServerRendererHooks } from '../../../server/hooks'

/** Fresh hooks with every renderer plugin registered on them, or `undefined` when there are none. */
export function createRendererPluginHooks (): HookableCore<NuxtServerRendererHooks> | undefined {
  if (!plugins.length) {
    return
  }
  const hooks = new HookableCore<NuxtServerRendererHooks>()
  const context = { hooks: { hook: hooks.hook.bind(hooks) } }
  for (const plugin of plugins) {
    plugin(context)
  }
  return hooks
}
