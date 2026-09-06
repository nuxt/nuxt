import type { RendererEvent } from 'nuxt/internal/renderer/runtime'

/**
 * The request event the renderer reads, described in web standards only: a platform
 * `Request`, its URL, a mutable response to influence, and a context the app layer stores
 * per-request state in.
 */
export function createRequestEvent (request: Request): RendererEvent {
  return {
    req: request,
    url: new URL(request.url),
    res: { headers: new Headers() },
    context: {},
  } as unknown as RendererEvent
}
