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
            return fetch(new Request(`http://localhost${resource}`, init), context)
          })
          .then(resolve, reject)
          .finally(() => signal?.removeEventListener('abort', abort))
      })
    }
    return globalThis.fetch(resource, init)
  }
}
