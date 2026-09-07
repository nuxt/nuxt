import { AsyncLocalStorage } from 'node:async_hooks'
import type { ServerRequest } from 'nitro/types'
import { createNuxtRenderer } from 'nuxt/internal/renderer'

import { NUXT_ASYNC_CONTEXT } from '#internal/nuxt/nitro-config.mjs'
import { createEvent } from '../utils/base'
import { applyPrerenderHints } from '../utils/prerender'
import { rendererInstance } from '../utils/renderer/options'

// Polyfill for unctx (https://github.com/unjs/unctx#native-async-context)
if (NUXT_ASYNC_CONTEXT && !('AsyncLocalStorage' in globalThis)) {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage
}

const renderer = createNuxtRenderer(rendererInstance)

export default {
  async fetch (request: ServerRequest): Promise<Response> {
    const event = createEvent(request)
    const response = await renderer.fetch(event)
    if (import.meta.prerender) {
      applyPrerenderHints(event, response.headers)
    }
    return response
  },
}
