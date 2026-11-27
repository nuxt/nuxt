import type { H3Event } from 'nitro/h3'

const kEndedResponse = Symbol.for('nuxt.compat.endedResponse')

/**
 * Make `response` the response of the request, as an h3 v1 helper that ended the response
 * did. The v1 handler wrappers send it in place of what the handler returns, and in place of
 * running a later v1 handler. A request that has already been ended keeps its response.
 * Kept off `event.context`, which sub-requests copy.
 */
export function endResponse<T> (event: H3Event, response: T): T {
  if (getEndedResponse(event) === undefined) {
    Reflect.defineProperty(event, kEndedResponse, { configurable: true, writable: true, value: response })
  }
  return response
}

/** The response an h3 v1 helper ended the request with, if one did. */
export function getEndedResponse (event: H3Event): unknown {
  return (event as unknown as Record<symbol, unknown>)[kEndedResponse]
}

/** The response an h3 v1 helper ended the request with, removed so that it is sent once. */
export function takeEndedResponse (event: H3Event): unknown {
  const response = getEndedResponse(event)
  Reflect.deleteProperty(event, kEndedResponse)
  return response
}
