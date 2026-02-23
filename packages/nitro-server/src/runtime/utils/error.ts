import type { HTTPEvent } from 'nitro/h3'
import { FastURL } from 'srvx'

/**
 * Nitro internal functions extracted from https://github.com/nitrojs/nitro/blob/v2/src/runtime/internal/utils.ts
 */

export function isJsonRequest (event: HTTPEvent): boolean {
  // If the client specifically requests HTML, then avoid classifying as JSON.
  if (event.req.headers.get('accept')?.includes('text/html')) {
    return false
  }
  const url = new FastURL(event.req.url)
  return (
    hasReqHeader(event, 'accept', 'application/json') ||
    hasReqHeader(event, 'user-agent', 'curl/') ||
    hasReqHeader(event, 'user-agent', 'httpie/') ||
    hasReqHeader(event, 'sec-fetch-mode', 'cors') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('.json')
  )
}

export function hasReqHeader (event: HTTPEvent, name: string, includes: string): boolean {
  const value = event.req.headers.get(name)
  return !!(
    value && value.toLowerCase().includes(includes)
  )
}
