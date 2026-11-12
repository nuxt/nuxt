import type { NuxtRequestEvent } from '@nuxt/schema'

/**
 * The request event the renderer reads, described in web standards only: a platform
 * `Request`, its URL, a mutable response to influence, and a context the app layer stores
 * per-request state in, seeded with `context` when one is given.
 */
export function createRequestEvent (request: Request, context?: Record<string, unknown>): NuxtRequestEvent {
  return {
    req: request,
    url: new URL(request.url),
    res: { headers: new Headers() },
    context: { ...context },
  } as unknown as NuxtRequestEvent
}
