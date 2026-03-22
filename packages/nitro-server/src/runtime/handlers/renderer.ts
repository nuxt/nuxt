import type { NuxtPayload } from 'nuxt/app'
import { HTTPError, defineEventHandler, getQuery } from 'nitro/h3'

import { renderPage } from './renderer.common'

const handler: ReturnType<typeof defineEventHandler> = defineEventHandler((event) => {
  // Whether we're rendering an error page
  const ssrError = event.url.pathname.startsWith('/__nuxt_error')
    ? getQuery<NuxtPayload['error'] & { url: string }>(event)
    : null

  if (ssrError && !event.context.nuxt?.['~internal'] /* allow internal fetch */) {
    throw new HTTPError({
      status: 404,
      statusText: 'Page Not Found: /__nuxt_error',
    })
  }

  return renderPage(event, ssrError)
})

export default handler
