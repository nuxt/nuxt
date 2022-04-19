import { withQuery } from 'ufo'
import type { NitroErrorHandler } from 'nitropack'
// @ts-ignore TODO
import { normalizeError, isJsonRequest } from '#internal/nitro/utils'

export default <NitroErrorHandler> async function errorhandler (_error, event) {
  // Parse and normalize error
  const { stack, statusCode, statusMessage, message } = normalizeError(_error)

  // Create an error object
  const errorObject = {
    url: event.req.url,
    statusCode,
    statusMessage,
    message,
    description: process.env.NODE_ENV === 'development' && statusCode !== 404
      ? `<pre>${stack.map(i => `<span class="stack${i.internal ? ' internal' : ''}">${i.text}</span>`).join('\n')}</pre>`
      : ''
  }

  // Set response code and message
  event.res.statusCode = errorObject.statusCode
  event.res.statusMessage = errorObject.statusMessage

  // Console output
  if (errorObject.statusCode !== 404) {
    console.error('[nuxt] [request error]', errorObject.message + '\n' + stack.map(l => '  ' + l.text).join('  \n'))
  }

  // JSON response
  if (isJsonRequest(event)) {
    event.res.setHeader('Content-Type', 'application/json')
    event.res.end(JSON.stringify(errorObject))
    return
  }

  // HTML response
  const url = withQuery('/__nuxt_error', errorObject as any)
  const html = await $fetch(url).catch((error) => {
    console.error('[nitro] Error while generating error response', error)
    return errorObject.statusMessage
  })

  event.res.setHeader('Content-Type', 'text/html;charset=UTF-8')
  event.res.end(html)
}
