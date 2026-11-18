const renderedErrorPages = new WeakSet<object>()

/** Record that the renderer answers the request with an error page it renders itself. */
export function markRenderedErrorPage (context: object): void {
  renderedErrorPages.add(context)
}

/** Whether the renderer answered the request with an error page it rendered itself. */
export function isRenderedErrorPage (context: object | undefined): boolean {
  return !!context && renderedErrorPages.has(context)
}
