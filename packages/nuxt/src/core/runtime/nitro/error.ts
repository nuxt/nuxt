import { withQuery } from 'ufo'
import type { NitroErrorHandler } from 'nitropack'
import type { H3Error } from 'h3'
import { normalizeError, isJsonRequest } from '#internal/nitro/utils'

export default <NitroErrorHandler> async function errorhandler (error: H3Error, event) {
  // Parse and normalize error
  const { stack, statusCode, statusMessage, message } = normalizeError(error)

  // Create an error object
  const errorObject = {
    url: event.req.url,
    statusCode,
    statusMessage,
    message,
    stack: process.dev && statusCode !== 404
      ? `<pre>${stack.map(i => `<span class="stack${i.internal ? ' internal' : ''}">${i.text}</span>`).join('\n')}</pre>`
      : '',
    data: error.data
  }

  // Set response code and message
  event.res.statusCode = (errorObject.statusCode !== 200 && errorObject.statusCode) as any as number || 500
  if (errorObject.statusMessage) {
    event.res.statusMessage = errorObject.statusMessage
  }
  // Console output
  if (error.unhandled || error.fatal) {
    const tags = [
      '[nuxt]',
      '[request error]',
      error.unhandled && '[unhandled]',
      error.fatal && '[fatal]',
      Number(errorObject.statusCode) !== 200 && `[${errorObject.statusCode}]`
    ].filter(Boolean).join(' ')
    console.error(tags, errorObject.message + '\n' + stack.map(l => '  ' + l.text).join('  \n'))
  }

  // JSON response
  if (isJsonRequest(event)) {
    event.res.setHeader('Content-Type', 'application/json')
    event.res.end(JSON.stringify(errorObject))
    return
  }

  // HTML response (via SSR)
  const isErrorPage = event.req.url?.startsWith('/__nuxt_error')
  let html = !isErrorPage
    ? await $fetch(withQuery('/__nuxt_error', errorObject), {
      headers: event.req.headers as HeadersInit
    }).catch(() => null)
    : null

  // Fallback to static rendered error page
  if (!html) {
    const { template } = process.dev
      // @ts-ignore
      ? await import('@nuxt/ui-templates/templates/error-dev.mjs')
      // @ts-ignore
      : await import('@nuxt/ui-templates/templates/error-500.mjs')
    if (process.dev) {
      // TODO: Support `message` in template
      (errorObject as any).description = errorObject.message
    }
    html = template(errorObject)
  }

  event.res.setHeader('Content-Type', 'text/html;charset=UTF-8')
  event.res.end(html)
}
