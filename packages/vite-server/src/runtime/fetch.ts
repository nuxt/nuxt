export const fetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args)

type AppFetch = (request: Request, context?: Record<string, unknown>) => Promise<Response>

/**
 * A `fetch` that sends a request for a path (`/...`) to the app handler in-process, with
 * `context` as the context of its request event, and any other request to the platform.
 */
export function createAppFetch (loadFetch: () => Promise<AppFetch>) {
  return (resource: RequestInfo | URL, init?: RequestInit, context?: Record<string, unknown>): Promise<Response> => {
    if (typeof resource === 'string' && resource[0] === '/') {
      const signal = init?.signal
      return new Promise<Response>((resolve, reject) => {
        const abort = () => reject(signal?.reason)
        if (signal?.aborted) {
          abort()
          return
        }
        signal?.addEventListener('abort', abort, { once: true })
        loadFetch()
          .then((fetch) => {
            signal?.throwIfAborted()
            return fetchFollowingRedirects(fetch, resource, init, context)
          })
          .then(resolve, reject)
          .finally(() => signal?.removeEventListener('abort', abort))
      })
    }
    return globalThis.fetch(resource, init)
  }
}

const LOCAL_ORIGIN = 'http://localhost'
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 20
const NORMALIZED_METHODS = new Set(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'])
const CREDENTIAL_HEADERS = ['authorization', 'cookie', 'proxy-authorization']
const REQUEST_BODY_HEADERS = ['content-encoding', 'content-language', 'content-length', 'content-location', 'content-type']

function normalizeMethod (method: string): string {
  const upper = method.toUpperCase()
  return NORMALIZED_METHODS.has(upper) ? upper : method
}

async function fetchFollowingRedirects (fetch: AppFetch, path: string, init: RequestInit | undefined, context?: Record<string, unknown>): Promise<Response> {
  const redirect = init?.redirect ?? 'follow'
  let url = path
  let method = normalizeMethod(init?.method ?? 'GET')
  let body = init?.body
  const headers = new Headers(init?.headers)
  for (let redirects = 0; ; redirects++) {
    const response = await fetch(new Request(`${LOCAL_ORIGIN}${url}`, { ...init, method, body, headers }), context)
    const location = response.headers.get('location')
    if (!REDIRECT_STATUSES.has(response.status) || location === null || redirect === 'manual') {
      return response
    }
    if (redirect === 'error') {
      throw new TypeError('Fetch redirect is not allowed')
    }

    const toGet = (response.status === 303 && method !== 'GET' && method !== 'HEAD')
      || ((response.status === 301 || response.status === 302) && method === 'POST')
    await response.body?.cancel()
    if (!toGet && body instanceof ReadableStream) {
      throw new TypeError('Cannot follow a redirect that must resend a streamed body')
    }
    if (toGet) {
      method = 'GET'
      body = undefined
      for (const name of REQUEST_BODY_HEADERS) {
        headers.delete(name)
      }
    }

    const target = new URL(location, `${LOCAL_ORIGIN}${url}`)
    if (target.origin !== LOCAL_ORIGIN) {
      for (const name of CREDENTIAL_HEADERS) {
        headers.delete(name)
      }
      return globalThis.fetch(target, { ...init, method, body, headers })
    }
    if (redirects >= MAX_REDIRECTS) {
      throw new TypeError('Too many redirects')
    }
    url = `${target.pathname}${target.search}`
  }
}
