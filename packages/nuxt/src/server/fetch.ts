import type { RequestEvent } from 'nuxt/schema'

import { createError } from '../app/error'

/**
 * Options for {@link serverFetch}.
 *
 * @since 4.6.0
 */
export interface ServerFetchInit extends RequestInit {
  /**
   * Headers to copy from the incoming request. `true` copies `cookie` and `authorization`.
   *
   * @default true
   */
  forwardHeaders?: boolean | string[]
}

const DEFAULT_FORWARDED_HEADERS = ['cookie', 'authorization']

/** @internal */
export function resolveServerFetchInit (event: Pick<RequestEvent, 'req'>, init: ServerFetchInit = {}): RequestInit {
  const { forwardHeaders = true, ...requestInit } = init
  const headers = new Headers(requestInit.headers)
  const names = forwardHeaders === true ? DEFAULT_FORWARDED_HEADERS : forwardHeaders || []
  for (const name of names) {
    const value = event.req.headers.get(name)
    if (value !== null && !headers.has(name)) {
      headers.set(name, value)
    }
  }
  return { ...requestInit, headers }
}

/**
 * Fetch a route of this app in-process. The path is relative to the app base URL.
 *
 * @example
 * ```ts
 * const response = await serverFetch(event, '/api/robots-rules')
 * const rules = await response.json()
 * ```
 *
 * @throws a `500` when the server builder provides no in-process fetch.
 * @since 4.6.0
 */
export function serverFetch (_event: Pick<RequestEvent, 'req' | 'context'>, path: string, _init?: ServerFetchInit): Promise<Response> {
  return Promise.reject(createError({
    status: 500,
    message: `\`serverFetch('${path}')\` is not supported by the configured server builder.`,
  }))
}
