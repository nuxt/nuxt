import type { HTTPEvent } from 'h3'

/**
 * Nitro internal functions extracted from https://github.com/nitrojs/nitro/blob/v2/src/runtime/internal/utils.ts
 */

export function isJsonRequest (event: HTTPEvent) {
  // If the client specifically requests HTML, then avoid classifying as JSON.
  if (event.req.headers.get('accept')?.includes('text/html')) {
    return false
  }
  return (
    event.req.headers.get('accept') === 'application/json' ||
    event.req.headers.get('user-agent')?.startsWith('curl/') ||
    event.req.headers.get('user-agent')?.startsWith('httpie/') ||
    event.req.headers.get('sec-fetch-mode') === 'cors'
  )
}
