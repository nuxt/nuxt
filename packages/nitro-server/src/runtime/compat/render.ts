import { defineHandler } from 'nitro/h3'
import { useNitroApp } from 'nitro/app'
import type { H3Event } from 'nitro/h3'

import { applyLegacyRenderResponse } from './render-response.ts'

export interface LegacyRenderResponse {
  body: any
  statusCode?: number
  statusMessage?: string
  headers?: Record<string, string>
}

/**
 * v2 `defineRenderHandler`, which took a render function returning a
 * `{ body, statusCode, statusMessage, headers }` object rather than a response.
 */
export function defineRenderHandler (render: (event: H3Event) => LegacyRenderResponse | Promise<LegacyRenderResponse>): any {
  return defineHandler(async (event: H3Event) => {
    const response = await render(event)
    if (!response) {
      return
    }

    if (response.statusCode !== undefined) {
      event.res.status = response.statusCode
    }
    if (response.statusMessage !== undefined) {
      event.res.statusText = response.statusMessage
    }
    for (const [name, value] of Object.entries(response.headers || {})) {
      event.res.headers.set(name, value)
    }

    const body = await applyLegacyRenderResponse(event, (useNitroApp().hooks || { callHook: () => {} }) as any, typeof response.body === 'string' ? response.body : undefined)

    return typeof response.body === 'string' ? body : response.body
  })
}
