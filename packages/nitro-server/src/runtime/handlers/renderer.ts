import { AsyncLocalStorage } from 'node:async_hooks'
import type { EventHandler, H3Event } from 'h3'
import { setResponseHeader } from 'h3'
import { defineRenderHandler, useNitroApp } from 'nitropack/runtime'
import type { RenderResponse } from 'nitropack/types'
import { createNuxtRenderer } from 'nuxt/internal/renderer'
import { encodeDocument } from 'nuxt/internal/renderer/encode'

import { NUXT_ASYNC_CONTEXT } from '#internal/nuxt/nitro-config.mjs'
import { toRequestEvent } from '../utils/event'
import { applyPrerenderHints } from '../utils/prerender'
import { rendererInstance } from '../utils/renderer/options'
import { createResponseHeaderRecord } from '../utils/response'
import type { NodeRenderResponse } from '../utils/response'

// Polyfill for unctx (https://github.com/unjs/unctx#native-async-context)
if (NUXT_ASYNC_CONTEXT && !('AsyncLocalStorage' in globalThis)) {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage
}

const renderer = createNuxtRenderer(rendererInstance)

const handler: EventHandler = defineRenderHandler(async (event): Promise<Partial<RenderResponse>> => {
  const response = await renderer.fetch(toRequestEvent(event))

  for (const [name, value] of response.headers) {
    // the node response is where the renderer wrote its own headers, and it is the only
    // place multiple cookies stay distinct, so it wins over the response's flat view
    if (name === 'set-cookie') { continue }
    setResponseHeader(event, name, value)
  }

  if (import.meta.prerender) {
    applyPrerenderHints(event)
  }

  const { chunks } = response as unknown as NodeRenderResponse

  return {
    body: chunks ? toDocumentBody(event, chunks) : response.body as RenderResponse['body'],
    statusCode: response.status,
    statusMessage: response.statusText || undefined,
    headers: createResponseHeaderRecord(event.node.res),
  }
})

/**
 * `render:response` listeners and nitro's cached handlers both expect a string body, so the
 * document is only encoded to bytes when neither will read it.
 */
function toDocumentBody (event: H3Event, chunks: string[]): RenderResponse['body'] {
  const listeners = (useNitroApp().hooks as unknown as { _hooks?: Record<string, unknown[] | undefined> })._hooks?.['render:response']
  if (event.context.cache || listeners?.length) {
    return chunks.join('')
  }
  return encodeDocument(chunks) as RenderResponse['body']
}

export default handler
