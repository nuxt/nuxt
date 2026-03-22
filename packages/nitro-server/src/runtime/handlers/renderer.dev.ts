import type { NuxtPayload } from 'nuxt/app'
import { H3Event, getQuery } from 'nitro/h3'
import { FastResponse } from 'srvx'

import { renderPage } from './renderer.common'

export default {
  async fetch (request: Request): Promise<Response> {
    const event = new H3Event(request)

    // Whether we're rendering an error page
    const ssrError = event.url.pathname.startsWith('/__nuxt_error')
      ? getQuery<NuxtPayload['error'] & { url: string }>(event)
      : null

    if (ssrError && !event.context.nuxt?.['~internal'] /* allow internal fetch */) {
      return new FastResponse('Page Not Found: /__nuxt_error', { status: 404 })
    }

    const body = await renderPage(event, ssrError)

    return new FastResponse(body, {
      status: event.res.status,
      statusText: event.res.statusText,
      headers: event.res.headers,
    })
  },
}
