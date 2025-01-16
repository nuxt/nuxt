import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { H3Event } from 'h3'
import {
  getRequestHeader,
  getRequestHeaders,
  getRequestURL,
  getResponseHeader,
  send,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import consola from 'consola'
import { ErrorParser } from 'youch-core'
import { Youch } from 'youch'
import { SourceMapConsumer } from 'source-map'
import { useNitroApp, useRuntimeConfig } from 'nitro/runtime'
import { joinURL, withQuery } from 'ufo'
import type { NuxtPayload } from 'nuxt/app'
import { defineNitroErrorHandler, setSecurityHeaders } from './utils'

export default defineNitroErrorHandler(
  async function defaultNitroErrorHandler (error, event) {
    const { stack, message, isSensitive, statusCode, statusMessage } = normalizeError(error)

    const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).toString()
    // https://github.com/poppinss/youch
    const youch = new Youch()

    if (import.meta.dev) {
      // Load stack trace with source maps
      await loadStackTrace(error).catch(consola.error)
    }

    // Create an error object
    const errorObject = {
      url: event.path,
      statusCode,
      statusMessage,
      message,
      stack: import.meta.dev && statusCode !== 404
        ? `<pre>${stack.map(i => `<span class="stack${i.internal ? ' internal' : ''}">${i.text}</span>`).join('\n')}</pre>`
        : '',
      // TODO: check and validate error.data for serialisation into query
      data: error.data as any,
    } satisfies Partial<NuxtPayload['error']> & { url: string }

    // Console output
    if (isSensitive) {
      let errorToLog: string = ''

      const tags = [
        '[nuxt]',
        '[request error]',
        error.unhandled && '[unhandled]',
        error.fatal && '[fatal]',
        Number(statusCode) !== 200 && `[${statusCode}]`,
      ].filter(Boolean).join(' ')

      if (import.meta.dev) {
        const columns = process.stderr.columns
        if (!columns) {
          process.stdout.columns = 90 // Temporary workaround for youch wrapping issue
        }
        const ansiError = (
          await youch.toANSI(error)
        ).replaceAll(process.cwd(), '.')
        if (!columns) {
          process.stderr.columns = columns
        }

        errorToLog = ansiError
      } else {
        errorToLog = error.message || error.toString() || 'internal server error'
      }

      console.error(`${tags} [${event.method}] ${url}\n\n`, errorToLog)
    }

    if (event.handled) { return }

    // Send response
    setResponseStatus(event, (statusCode !== 200 && statusCode) as any as number || 500, statusMessage)
    setSecurityHeaders(event, true /* allow js */)
    if (statusCode === 404 || !getResponseHeader(event, 'cache-control')) {
      setResponseHeader(event, 'cache-control', 'no-cache')
    }

    const isHtml = getRequestHeader(event, 'accept')?.includes('text/html')
    if (isHtml && import.meta.dev) {
      return send(
        event,
        await youch.toHTML(error, {
          request: {
            url,
            method: event.method,
            headers: getRequestHeaders(event),
          },
        }),
        'text/html',
      )
    }

    // JSON response
    if (isJsonRequest(event)) {
      return send(
        event,
        JSON.stringify(
          {
            error: true,
            url,
            statusCode,
            statusMessage,
            message: error.message,
            data: error.data,
            stack: error.stack?.split('\n').map(line => line.trim()),
          },
          null,
          2,
        ),
        'application/json',
      )
    }

    // Access request headers
    const reqHeaders = getRequestHeaders(event)

    // Detect to avoid recursion in SSR rendering of errors
    const isRenderingError = event.path.startsWith('/__nuxt_error') || !!reqHeaders['x-nuxt-error']

    // HTML response (via SSR)
    const res = isRenderingError
      ? null
      : await useNitroApp().localFetch(
        withQuery(joinURL(useRuntimeConfig(event).app.baseURL, '/__nuxt_error'), errorObject),
        {
          headers: { ...reqHeaders, 'x-nuxt-error': 'true' },
          redirect: 'manual',
        },
      ).catch(() => null)

    // Fallback to static rendered error page
    if (!res) {
      const { template } = import.meta.dev ? await import('./error-dev') : await import('./error-500')
      if (import.meta.dev) {
        // TODO: Support `message` in template
        (errorObject as any).description = errorObject.message
      }
      if (event.handled) { return }
      setResponseHeader(event, 'Content-Type', 'text/html;charset=UTF-8')
      return send(event, template(errorObject))
    }

    const html = await res.text()
    if (event.handled) { return }

    for (const [header, value] of res.headers.entries()) {
      setResponseHeader(event, header, value)
    }
    setResponseStatus(event, res.status && res.status !== 200 ? res.status : undefined, res.statusText)

    return send(event, html)
  },
)

// ---- Source Map support ----

export async function loadStackTrace (error: any) {
  if (!(error instanceof Error)) {
    return
  }
  const parsed = await new ErrorParser()
    .defineSourceLoader(sourceLoader)
    .parse(error)

  const stack =
    error.message +
    '\n' +
    parsed.frames.map(frame => fmtFrame(frame)).join('\n')

  Object.defineProperty(error, 'stack', { value: stack })

  if (error.cause) {
    await loadStackTrace(error.cause).catch(consola.error)
  }
}

type SourceLoader = Parameters<ErrorParser['defineSourceLoader']>[0]
type StackFrame = Parameters<SourceLoader>[0]

async function sourceLoader (frame: StackFrame) {
  if (!frame.fileName || frame.fileType !== 'fs' || frame.type === 'native') {
    return
  }

  if (frame.type === 'app') {
    // prettier-ignore
    const rawSourceMap = await readFile(`${frame.fileName}.map`, 'utf8').catch(() => { })
    if (rawSourceMap) {
      const consumer = await new SourceMapConsumer(rawSourceMap)
      // prettier-ignore
      const originalPosition = consumer.originalPositionFor({ line: frame.lineNumber!, column: frame.columnNumber! })
      if (originalPosition.source && originalPosition.line) {
        // prettier-ignore
        frame.fileName = resolve(dirname(frame.fileName), originalPosition.source)
        frame.lineNumber = originalPosition.line
        frame.columnNumber = originalPosition.column || 0
      }
    }
  }

  const contents = await readFile(frame.fileName, 'utf8').catch(() => { })
  return contents ? { contents } : undefined
}

function fmtFrame (frame: StackFrame) {
  if (frame.type === 'native') {
    return frame.raw
  }
  const src = `${frame.fileName || ''}:${frame.lineNumber}:${frame.columnNumber})`
  return frame.functionName ? `at ${frame.functionName} (${src}` : `at ${src}`
}

function isJsonRequest (event: H3Event) {
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

function hasReqHeader (event: H3Event, name: string, includes: string) {
  const value = getRequestHeader(event, name)
  return (
    value && typeof value === 'string' && value.toLowerCase().includes(includes)
  )
}

function normalizeError (error: any) {
  // temp fix for https://github.com/nitrojs/nitro/issues/759
  // TODO: investigate vercel-edge not using unenv pollyfill
  const cwd = typeof process.cwd === 'function' ? process.cwd() : '/'

  // Hide details of unhandled/fatal errors in production
  const hideDetails = !import.meta.dev && error.unhandled

  const stack = hideDetails && !import.meta.prerender
    ? []
    : ((error.stack as string) || '')
        .split('\n')
        .splice(1)
        .filter(line => line.includes('at '))
        .map((line) => {
          const text = line
            .replace(cwd + '/', './')
            .replace('webpack:/', '')
            .replace('file://', '')
            .trim()
          return {
            text,
            internal:
            (line.includes('node_modules') && !line.includes('.cache')) ||
            line.includes('internal') ||
            line.includes('new Promise'),
          }
        })

  const message = hideDetails ? 'internal server error' : (error.message || error.toString())
  const isSensitive = error.unhandled || error.fatal
  const statusCode = error.statusCode || 500
  const statusMessage = error.statusMessage || 'Server Error'

  return {
    stack,
    message,
    isSensitive,
    statusCode,
    statusMessage,
  }
}
