import type {
  H3Event } from 'h3'
import {
  getRequestURL,
  getResponseHeader,
  send,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import { defineNitroErrorHandler, setSecurityHeaders } from './utils'

export default defineNitroErrorHandler(
  function defaultNitroErrorHandler (error, _event) {
    const isSensitive = error.unhandled || error.fatal
    const statusCode = error.statusCode || 500
    const statusMessage = error.statusMessage || 'Server Error'
    const event = _event as H3Event
    // prettier-ignore
    const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).toString()

    // Console output
    if (isSensitive) {
      // prettier-ignore
      const tags = [error.unhandled && '[unhandled]', error.fatal && '[fatal]'].filter(Boolean).join(' ')
      console.error(
        `[nitro] [request error] ${tags} [${event.method}] ${url}\n`,
        error,
      )
    }

    // Send response
    setSecurityHeaders(event, false /* no js */)
    setResponseStatus(event, statusCode, statusMessage)
    if (statusCode === 404 || !getResponseHeader(event, 'cache-control')) {
      setResponseHeader(event, 'cache-control', 'no-cache')
    }
    return send(
      event,
      JSON.stringify(
        {
          error: true,
          url,
          statusCode,
          statusMessage,
          message: isSensitive ? 'Server Error' : error.message,
          data: isSensitive ? undefined : error.data,
        },
        null,
        2,
      ),
      'application/json',
    )
  },
)
