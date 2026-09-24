/** An error normalised into what the response and the error page need from it. */
export interface DescribedError {
  status: number
  statusText: string
  message: string
  /** The error's `data`, present only where it is safe to expose. */
  data: unknown
  headers: Record<string, string>
  /** Whether the error named an HTTP status itself, rather than being given 500. */
  isHTTPError: boolean
}

/**
 * Whether the error is one the app raised deliberately, as h3 recognises its own: by the brand
 * h3 v1 puts on its constructor (or the name h3 v2 gives it) and by status, rather than by shape.
 * Anything else reached the response by accident, so its message, data and headers are the
 * server's own and are not exposed.
 */
function isRaisedByApp (error: unknown): boolean {
  const candidate = error as { name?: unknown, status?: unknown, statusCode?: unknown, unhandled?: boolean, constructor?: { __h3_error__?: unknown } } | null
  const status = candidate?.status ?? candidate?.statusCode
  return error instanceof Error
    && (candidate!.constructor?.__h3_error__ === true || candidate!.name === 'HTTPError')
    && typeof status === 'number'
    && status > 99
    && !candidate!.unhandled
}

/** Reduce `data` to what JSON carries; a value the payload cannot serialise takes the error page down with it. */
function jsonSafeData (data: unknown): unknown {
  if (data === undefined) {
    return undefined
  }
  try {
    return JSON.parse(JSON.stringify(data))
  } catch {
    return undefined
  }
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
  const { status, statusCode, statusText, statusMessage, message, headers, data } = (error || {}) as { status?: number, statusCode?: number, statusText?: string, statusMessage?: string, message?: string, headers?: unknown, data?: unknown }
  const named = status ?? statusCode
  const isHTTPError = typeof named === 'number' && named >= 400 && named <= 599
  const exposed = import.meta.dev || (isHTTPError && isRaisedByApp(error))
  const reason = (isHTTPError && (statusText || statusMessage)) || (exposed && message) || (isHTTPError ? 'Request failed' : 'Internal Server Error')
  return {
    status: isHTTPError ? named : 500,
    statusText: reason.replace(INVALID_REASON_PHRASE_RE, '') || 'Error',
    message: (exposed && message) || reason,
    data: exposed ? jsonSafeData(data) : undefined,
    headers: exposed ? (headers instanceof Headers ? Object.fromEntries(headers) : (headers as Record<string, string> | undefined) ?? {}) : {},
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
  return isRaisedByApp(error) && described.isHTTPError && described.status < 500 && !(typeof error === 'object' && error !== null && THROWN_VALUE in error)
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
 * Stringify `error.data` the way it reaches the error page as a query parameter, for an error
 * rendered in process under `experimental.parseErrorData: false`.
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
