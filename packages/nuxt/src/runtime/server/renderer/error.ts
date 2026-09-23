import type { NuxtPayload } from '#app/types'

/**
 * Query parameter carrying the JSON-encoded error to `/__nuxt_error`.
 *
 * @internal
 */
export const SSR_ERROR_PARAM = '__nuxt_error_payload'

/**
 * Mirror of `NUXT_ERROR_SIGNATURE` in `#app/composables/error`, redeclared so
 * the renderer does not pull app runtime code into the server bundle.
 *
 * @internal
 */
export const NUXT_ERROR_SIGNATURE = '__nuxt_error'

export type SSRError = NonNullable<NuxtPayload['error']> & { url: string }

/**
 * Writable subset of {@link SSRError} the error handler assembles from Nitro's
 * error body before encoding it.
 *
 * @internal
 */
export type SSRErrorInput = {
  -readonly [K in 'status' | 'statusText' | 'message' | 'stack' | 'fatal']?: SSRError[K]
} & { url?: string, data?: unknown }

/**
 * Encode the error the error handler sends to `/__nuxt_error`.
 *
 * `data` is arbitrary user input, so it can be cyclic or hold values JSON
 * refuses. Dropping it beats throwing, because throwing here loses the error
 * page along with the error it was reporting.
 *
 * @internal
 */
export function encodeSSRError (error: SSRErrorInput): string {
  try {
    return JSON.stringify(error)
  } catch {
    try {
      return JSON.stringify({ ...error, data: undefined })
    } catch {
      return '{}'
    }
  }
}

/**
 * Rebuild the error the error handler sent to `/__nuxt_error`.
 *
 * The result stays a plain object rather than a `NuxtError` instance, to keep
 * the class out of the server bundle. The signature `isNuxtError` looks for is
 * added on arrival rather than sent, as every error reaching this route is one
 * by definition.
 *
 * @internal
 */
export function decodeSSRError (encoded: string | undefined): SSRError | undefined {
  if (!encoded) { return undefined }
  try {
    return { ...JSON.parse(encoded), [NUXT_ERROR_SIGNATURE]: true } as SSRError
  } catch {
    return undefined
  }
}

/** An error normalised into what the response and the error page need from it. */
export interface DescribedError {
  status: number
  statusText: string
  message: string
  headers: Record<string, string>
  /** Whether the error named an HTTP status itself, rather than being given 500. */
  isHTTPError: boolean
}

// a reason phrase is limited to HTAB / SP / VCHAR / obs-text, and `Response` throws on anything else
const INVALID_REASON_PHRASE_RE = /[^\t\x20-\x7E\x80-\xFF]/g

/**
 * Read the status, reason phrase and headers to answer a caught error with. An error naming no
 * status is the server's own, whose message is only exposed in development.
 *
 * @internal
 */
export function describeError (error: unknown): DescribedError {
  const { status, statusCode, statusText, message, headers } = (error || {}) as { status?: number, statusCode?: number, statusText?: string, message?: string, headers?: unknown }
  const named = status ?? statusCode
  const isHTTPError = typeof named === 'number' && named >= 400 && named <= 599
  const exposed = isHTTPError || import.meta.dev
  const reason = (exposed && (statusText || message)) || (isHTTPError ? 'Request failed' : 'Internal Server Error')
  return {
    status: isHTTPError ? named : 500,
    statusText: reason.replace(INVALID_REASON_PHRASE_RE, '') || 'Error',
    message: (exposed && message) || reason,
    headers: headers instanceof Headers ? Object.fromEntries(headers) : (headers as Record<string, string> | undefined) ?? {},
    isHTTPError,
  }
}

/** Set when the app threw a bare value, which was given its status on the way out. */
const THROWN_VALUE = Symbol.for('nuxt:dev:thrown')

/**
 * Whether the error is the app working as intended: a 404 or a failed validation it raised
 * deliberately.
 *
 * @internal
 */
export function isExpectedError (error: unknown, described: DescribedError): boolean {
  const candidate = (error || {}) as { unhandled?: boolean }
  return !candidate.unhandled && described.isHTTPError && described.status < 500 && !(typeof error === 'object' && error !== null && THROWN_VALUE in error)
}

/**
 * Add `value`'s tokens to the `vary` header, keeping any already present. `*` absorbs
 * everything else, since it means the response varies on all headers.
 *
 * @internal
 */
export function appendVary (headers: Headers, value: string): void {
  const incoming = parseVary(value)
  if (!incoming.length) {
    return
  }
  const existing = parseVary(headers.get('vary'))
  if (existing.includes('*')) {
    return
  }
  if (incoming.includes('*')) {
    headers.set('vary', '*')
    return
  }
  const merged = existing.slice()
  for (const token of incoming) {
    if (!merged.includes(token)) {
      merged.push(token)
    }
  }
  headers.set('vary', merged.join(', '))
}

function parseVary (value: string | null): string[] {
  return value ? value.split(',').map(token => token.trim().toLowerCase()).filter(Boolean) : []
}

/**
 * Restore the stringified `error.data` that `experimental.parseErrorData: false`
 * used to produce, back when the error reached the error page as query
 * parameters. Nothing stringifies it now, so it is reproduced here for apps
 * that still expect a string.
 *
 * Callers must guard this with the `PARSE_ERROR_DATA` constant directly, so the
 * default build folds the branch away and drops this entirely.
 *
 * @internal
 */
export function stringifyErrorData (data: unknown): unknown {
  return data === undefined || typeof data === 'string' ? data : JSON.stringify(data)
}

/**
 * Whether the client asked for JSON rather than a page, so an error must be answered with a
 * JSON body. An explicit request for HTML wins over every other signal.
 *
 * @internal
 */
export function isJsonRequest (request: Request, pathname: string): boolean {
  if (request.headers.get('accept')?.includes('text/html')) {
    return false
  }
  return (
    hasHeader(request, 'accept', 'application/json')
    || hasHeader(request, 'user-agent', 'curl/')
    || hasHeader(request, 'user-agent', 'httpie/')
    || hasHeader(request, 'sec-fetch-mode', 'cors')
    || pathname.startsWith('/api/')
    || pathname.endsWith('.json')
  )
}

function hasHeader (request: Request, name: string, includes: string): boolean {
  const value = request.headers.get(name)
  return !!(value && value.toLowerCase().includes(includes))
}
