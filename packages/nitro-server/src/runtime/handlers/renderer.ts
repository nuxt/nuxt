import { AsyncLocalStorage } from 'node:async_hooks'
import type { ServerRequest } from 'nitro/types'
import { useNitroApp, useNitroHooks } from 'nitro/app'
import { FastResponse } from 'srvx'
import { createNuxtRenderer } from 'nuxt/internal/renderer'

import { NUXT_ASYNC_CONTEXT } from '#internal/nuxt/nitro-config.mjs'
import { createEvent } from '../utils/base'
import { applyPrerenderHints } from '../utils/prerender'
import { rendererInstance } from '../utils/renderer/options'
import { hasLegacyHookListener } from '../compat/hook-registry'
import { decorateLegacyEvent } from '../compat/decorate'
import { applyLegacyRenderResponseTo } from '../compat/render-response'
import { legacyCompat } from '#nuxt-compat/flags'

// Polyfill for unctx (https://github.com/unjs/unctx#native-async-context)
if (NUXT_ASYNC_CONTEXT && !('AsyncLocalStorage' in globalThis)) {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage
}

const renderer = createNuxtRenderer(rendererInstance)

export default {
  async fetch (request: ServerRequest): Promise<Response> {
    const event = createEvent(request)

    // the render event is built here rather than by h3's routing, so nitro's `request`
    // hook never saw it and the v2 decoration has to be applied directly
    if (legacyCompat) {
      decorateLegacyEvent(event, useNitroApp())
    }

    let response = await renderer.fetch(event)

    if (legacyCompat) {
      const hooks = useNitroHooks()
      if (hasLegacyHookListener(hooks, 'render:response')) {
        response = await applyLegacyRenderResponseTo(event, hooks, response, (body, init) => new FastResponse(body, init))
      }
    }

    // after the v2 hook, which rebuilds the response from `event.res` when a listener
    // changed anything: hints written onto the response it replaces would be lost
    if (import.meta.prerender) {
      applyPrerenderHints(event, response.headers)
    }

    return response
  },
}
