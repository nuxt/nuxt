import { AsyncLocalStorage } from 'node:async_hooks'
import type { ServerRequest } from 'nitro/types'
import { createNuxtRenderer } from 'nuxt/internal/renderer'

import { NUXT_ASYNC_CONTEXT } from '#internal/nuxt/nitro-config.mjs'
import { createEvent } from '../utils/base'
import { rendererInstance } from '../utils/renderer/options'

// Polyfill for unctx (https://github.com/unjs/unctx#native-async-context)
if (NUXT_ASYNC_CONTEXT && !('AsyncLocalStorage' in globalThis)) {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage
}

const renderer = createNuxtRenderer(rendererInstance)

export default {
  fetch (request: ServerRequest): Promise<Response> {
    return renderer.fetch(createEvent(request))
  },
}
