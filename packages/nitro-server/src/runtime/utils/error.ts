import type { H3Event } from 'nitro/h3'

/**
 * Nitro internal functions extracted from https://github.com/nitrojs/nitro/blob/v2/src/runtime/internal/utils.ts
 */

export function isJsonRequest (event: H3Event): boolean {
  // If the client specifically requests HTML, then avoid classifying as JSON.
  if (event.req.headers.get('accept')?.includes('text/html')) {
    return false
  }
  const url = event.url.pathname
  return (
    hasReqHeader(event, 'accept', 'application/json') ||
    hasReqHeader(event, 'user-agent', 'curl/') ||
    hasReqHeader(event, 'user-agent', 'httpie/') ||
    hasReqHeader(event, 'sec-fetch-mode', 'cors') ||
    url.startsWith('/api/') ||
    url.endsWith('.json')
  )
}

export function hasReqHeader (event: H3Event, name: string, includes: string): boolean {
  const value = event.req.headers.get(name)
  return !!(
    value && value.toLowerCase().includes(includes)
  )
}
