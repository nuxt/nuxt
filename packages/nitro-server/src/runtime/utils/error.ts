import { getRequestHeader } from 'h3'
import type { H3Event } from 'h3'

/**
 * Nitro internal functions extracted from https://github.com/nitrojs/nitro/blob/main/src/runtime/internal/utils.ts
 */

export function isJsonRequest (event: H3Event) {
  // If the client specifically requests HTML, then avoid classifying as JSON.
  if (hasReqHeader(event, 'accept', 'text/html')) {
    return false
  }
  return (
    hasReqHeader(event, 'accept', 'application/json') ||
    hasReqHeader(event, 'user-agent', 'curl/') ||
    hasReqHeader(event, 'user-agent', 'httpie/') ||
    hasReqHeader(event, 'sec-fetch-mode', 'cors') ||
    event.path.startsWith('/api/') ||
    event.path.endsWith('.json')
  )
}

export function hasReqHeader (event: H3Event, name: string, includes: string) {
  const value = getRequestHeader(event, name)
  return (
    value && typeof value === 'string' && value.toLowerCase().includes(includes)
  )
}
