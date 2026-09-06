import { AsyncLocalStorage } from 'node:async_hooks'
import type { EventHandler } from 'h3'
import { setResponseHeader } from 'h3'
import { defineRenderHandler } from 'nitropack/runtime'
import type { RenderResponse } from 'nitropack/types'
import { createNuxtRenderer } from 'nuxt/renderer'

import { NUXT_ASYNC_CONTEXT } from '#internal/nuxt/nitro-config.mjs'
import { toRequestEvent } from '../utils/event'
import { rendererOptions } from '../utils/renderer/options'

// Polyfill for unctx (https://github.com/unjs/unctx#native-async-context)
if (NUXT_ASYNC_CONTEXT && !('AsyncLocalStorage' in globalThis)) {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage
}

const renderer = createNuxtRenderer(rendererOptions)

const handler: EventHandler = defineRenderHandler(async (event): Promise<Partial<RenderResponse>> => {
  const response = await renderer.fetch(toRequestEvent(event))

  for (const [name, value] of response.headers) {
    // the node response is where the renderer wrote its own headers, and it is the only
    // place multiple cookies stay distinct, so it wins over the response's flat view
    if (name === 'set-cookie') { continue }
    setResponseHeader(event, name, value)
  }

  return {
    body: response.body as RenderResponse['body'],
    statusCode: response.status,
    statusMessage: response.statusText || undefined,
  }
})

export default handler
