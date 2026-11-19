// a registered symbol, as the renderer and Nitro's plugins may each load their own copy of this module
const kRenderedErrorPage = Symbol.for('nuxt.renderedErrorPage')

/** Record that the renderer answers the request with an error page it renders itself. */
export function markRenderedErrorPage (context: object): void {
  (context as Record<symbol, unknown>)[kRenderedErrorPage] = true
}

/** Whether the renderer answered the request with an error page it rendered itself. */
export function isRenderedErrorPage (context: object | undefined): boolean {
  return !!(context as Record<symbol, unknown> | undefined)?.[kRenderedErrorPage]
}
