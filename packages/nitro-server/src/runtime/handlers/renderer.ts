import { AsyncLocalStorage } from 'node:async_hooks'
import type { ServerRequest } from 'nitro/types'
import { createNuxtRenderer } from 'nuxt/renderer'

import { NUXT_ASYNC_CONTEXT } from '#internal/nuxt/nitro-config.mjs'
import { createEvent } from '../utils/base'
import { rendererOptions } from '../utils/renderer/options'

// Polyfill for unctx (https://github.com/unjs/unctx#native-async-context)
if (NUXT_ASYNC_CONTEXT && !('AsyncLocalStorage' in globalThis)) {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage
}

const renderer = createNuxtRenderer({
  ...rendererOptions,
  renderIsland: event => import('#internal/nuxt/island-renderer.mjs').then(r => r.default.fetch(event.req)),
})

export default {
  fetch (request: ServerRequest): Promise<Response> {
    return renderer.fetch(createEvent(request))
  },
}
