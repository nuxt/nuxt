export interface Middleware {
  handle: string
  route: string
}

export function resolveMiddleware (serverMiddleware: any[], resolvePath: (string) => string) {
  const middleware: Middleware[] = []
  const legacyMiddleware: Middleware[] = []

  for (let m of serverMiddleware) {
    if (typeof m === 'string') { m = { handler: m } }
    const route = m.path || m.route || '/'
    const handle = m.handler || m.handle
    if (typeof handle !== 'string' || typeof route !== 'string') {
      legacyMiddleware.push(m)
    } else {
      middleware.push({
        ...m,
        handle: resolvePath(handle),
        route
      })
    }
  }

  return {
    middleware,
    legacyMiddleware
  }
}
