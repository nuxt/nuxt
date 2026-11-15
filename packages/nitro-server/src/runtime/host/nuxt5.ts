/**
 * What the handlers of this builder need from the renderer of the Nuxt version they are
 * built for. Resolved as `#internal/nuxt/host`.
 */
import { SSR_ERROR_PARAM, encodeSSRError } from 'nuxt/internal/renderer/error'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'
import type { QueryObject } from 'ufo'

import type { PageRenderer, SSRErrorInput } from './nuxt4'

export { NUXT_ERROR_SIGNATURE } from 'nuxt/internal/renderer/error'
export { rethrowWithResponseHeaders, returnRenderResponse } from 'nuxt/internal/renderer/app'
export { patchDevClientCss } from 'nuxt/internal/renderer/dev-css'

export const docsVersion = '5.x'

/** The query the renderer reads the error to render from, on `/__nuxt_error`. */
export function errorPageQuery (error: SSRErrorInput): QueryObject {
  return { [SSR_ERROR_PARAM]: encodeSSRError(error) }
}

/** The response the app queued on `ssrContext['~renderResponse']`. */
export function toRenderResponse (_options: unknown, response: Response): Response {
  return response
}

/** The route rules the renderer is given for a request. */
export function withRouteRuleDefaults<T extends object> (rules: T): T {
  return rules
}

export function renderPage (renderer: PageRenderer, event: RendererEvent): Promise<Response> {
  return renderer.fetch(event)
}
