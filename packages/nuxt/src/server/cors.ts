import type { RequestEvent } from 'nuxt/schema'

/**
 * Options for {@link handleCors}. Every option defaults to the most permissive
 * value, so pass the ones to restrict.
 *
 * @since 4.6.0
 */
export interface CorsOptions {
  /**
   * The origins allowed: `'*'` for any, a list of exact origins or patterns, or
   * a function deciding for each origin. Patterns are tested unanchored, so
   * anchor and escape them.
   * @default '*'
   */
  origin?: '*' | 'null' | (string | RegExp)[] | ((origin: string) => boolean)
  /**
   * The methods a preflight allows. With `credentials`, `'*'` reflects the
   * requested method.
   * @default '*'
   */
  methods?: '*' | string[]
  /**
   * The request headers a preflight allows. `'*'` reflects the requested headers.
   * @default '*'
   */
  allowHeaders?: '*' | string[]
  /**
   * The response headers exposed to the client. `'*'` has no effect with `credentials`.
   * @default '*'
   */
  exposeHeaders?: '*' | string[]
  /** Whether the response may be shared with credentials. Requires an origin other than `'*'`. */
  credentials?: boolean
  /** How long, in seconds, a preflight may be cached, or `false` to leave it to the client. */
  maxAge?: string | false
  /** The status of a preflight response. */
  preflight?: { statusCode?: number }
}

type HeaderRecord = Record<string, string>

function isOriginAllowed (origin: string | null, option: CorsOptions['origin']): boolean {
  if (!origin) {
    return false
  }
  if (!option || option === '*') {
    return true
  }
  if (typeof option === 'function') {
    return option(origin)
  }
  if (Array.isArray(option)) {
    return option.some(allowed => allowed instanceof RegExp ? allowed.test(origin) : allowed === origin)
  }
  return option === origin
}

function originHeaders (request: Request, options: CorsOptions): HeaderRecord {
  if (!options.origin || options.origin === '*') {
    return { 'access-control-allow-origin': '*' }
  }
  const origin = request.headers.get('origin')
  return isOriginAllowed(origin, options.origin)
    ? { 'access-control-allow-origin': origin!, 'vary': 'origin' }
    : { vary: 'origin' }
}

function methodsHeaders (request: Request, { methods, credentials }: CorsOptions): HeaderRecord {
  if (!methods) {
    return {}
  }
  if (methods === '*') {
    if (!credentials) {
      return { 'access-control-allow-methods': '*' }
    }
    const requested = request.headers.get('access-control-request-method')
    return requested ? { 'access-control-allow-methods': requested, 'vary': 'access-control-request-method' } : {}
  }
  return methods.length > 0 ? { 'access-control-allow-methods': methods.join(',') } : {}
}

function allowHeadersHeaders (request: Request, { allowHeaders }: CorsOptions): HeaderRecord {
  if (!allowHeaders || allowHeaders === '*' || allowHeaders.length === 0) {
    const requested = request.headers.get('access-control-request-headers')
    return requested
      ? { 'access-control-allow-headers': requested, 'vary': 'access-control-request-headers' }
      : { vary: 'access-control-request-headers' }
  }
  return { 'access-control-allow-headers': allowHeaders.join(','), 'vary': 'access-control-request-headers' }
}

function exposeHeadersHeaders ({ exposeHeaders, credentials }: CorsOptions): HeaderRecord {
  if (!exposeHeaders) {
    return {}
  }
  if (exposeHeaders === '*') {
    return credentials ? {} : { 'access-control-expose-headers': '*' }
  }
  return { 'access-control-expose-headers': exposeHeaders.join(',') }
}

function applyHeaders (event: Pick<RequestEvent, 'res'>, headers: HeaderRecord): void {
  for (const name in headers) {
    if (name === 'vary') {
      event.res.headers.append(name, headers[name]!)
    } else {
      event.res.headers.set(name, headers[name]!)
    }
  }
}

/**
 * Apply CORS headers to the response. A preflight request is answered: the
 * returned `Response` is the handler's result, with the headers set on the
 * event's response. Any other request resolves `false` and continues.
 *
 * @example
 * ```ts
 * export default defineEventHandler((event) => {
 *   const preflight = handleCors(event, { origin: ['https://nuxt.com'], credentials: true })
 *   if (preflight) {
 *     return preflight
 *   }
 *   return { ok: true }
 * })
 * ```
 *
 * @since 4.6.0
 */
export function handleCors (event: Pick<RequestEvent, 'req' | 'res'>, options: CorsOptions = {}): Response | false {
  const resolved: CorsOptions = {
    origin: '*',
    methods: '*',
    allowHeaders: '*',
    exposeHeaders: '*',
    credentials: false,
    maxAge: false,
    ...options,
  }
  const request = event.req
  const credentials: HeaderRecord = resolved.credentials ? { 'access-control-allow-credentials': 'true' } : {}

  if (request.method === 'OPTIONS' && request.headers.get('origin') && request.headers.get('access-control-request-method')) {
    const groups = [
      originHeaders(request, resolved),
      credentials,
      methodsHeaders(request, resolved),
      allowHeadersHeaders(request, resolved),
      resolved.maxAge ? { 'access-control-max-age': resolved.maxAge } : {},
    ]
    const headers: HeaderRecord = Object.assign({}, ...groups)
    const vary = groups.map(group => group.vary).filter(Boolean)
    if (vary.length > 0) {
      headers.vary = vary.join(', ')
    }
    applyHeaders(event, headers)
    return new Response(null, { status: resolved.preflight?.statusCode ?? 204 })
  }

  applyHeaders(event, { ...originHeaders(request, resolved), ...credentials, ...exposeHeadersHeaders(resolved) })
  return false
}
