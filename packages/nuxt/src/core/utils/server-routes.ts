import { relative } from 'pathe'
import type { Route } from 'fetchdts/compiler'
import type { Nuxt, NuxtPage, ServerRequestTypes, ServerRouteHandler, ServerRouteSegment } from 'nuxt/schema'

/** The key used for handlers that answer every method, rather than one in particular. */
export const ALL_METHODS = 'default'

/**
 * The handlers serving one route pattern, grouped by the method they answer.
 *
 * A method can have more than one handler when several patterns match the same way -- either the
 * same route registered twice, or two patterns the router cannot tell apart, such as
 * `/users/:id(\d+)` and `/users/:slug([a-z]+)` -- in which case the route resolves to the union
 * of their return types.
 */
export interface ServerRouteInfo {
  /** The pattern this route matches, as split by the server's router. */
  segments: ServerRouteSegment[]
  /** The routes as originally written that resolved to these segments, for diagnostics. */
  routes: string[]
  /** Files implementing the route, keyed by lowercased method or {@link ALL_METHODS}. */
  handlers: Record<string, string[]>
}

/**
 * Identity of a route as the router sees it. Patterns that match the same paths share a key, so
 * they are grouped rather than emitted twice.
 */
function segmentKey (segments: ServerRouteSegment[]): string {
  let key = ''
  for (const segment of segments) {
    key += segment.type === 'static' ? segment.value : segment.type === 'dynamic' ? '/*' : '/**'
  }
  return key || '/'
}

/**
 * Groups route handlers by the pattern they match and the method they answer, dropping the ones
 * that do not describe a fetchable route, so that a template can emit one entry per route.
 *
 * Middleware is dropped because it does not serve a route of its own, and handlers without
 * segments or a file are dropped because there is nothing to emit for them. Routes and methods
 * are sorted so that regenerating types for an unchanged project produces an unchanged file.
 */
export function collectServerRoutes (handlers: ServerRouteHandler[]): ServerRouteInfo[] {
  const routes = new Map<string, ServerRouteInfo>()

  for (const handler of handlers) {
    if (handler.middleware || !handler.segments?.length || !handler.handler) { continue }

    const key = segmentKey(handler.segments)
    const info = routes.get(key) ?? { segments: handler.segments, routes: [], handlers: {} }

    if (handler.route && !info.routes.includes(handler.route)) {
      info.routes.push(handler.route)
    }

    const method = handler.method ? handler.method.toLowerCase() : ALL_METHODS
    const files = info.handlers[method] ??= []
    if (!files.includes(handler.handler)) {
      files.push(handler.handler)
    }

    routes.set(key, info)
  }

  return [...routes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, info]) => ({
      segments: info.segments,
      routes: [...info.routes].sort(),
      handlers: Object.fromEntries(Object.entries(info.handlers).sort(([a], [b]) => a.localeCompare(b))),
    }))
}

/** A reference to the handler's own type, which its request and response types are read from. */
function handlerType (handlerFile: string, typesDir: string) {
  const path = relative(typesDir, handlerFile).replace(/\.[cm]?[jt]sx?$/, '')
  return `typeof import(${JSON.stringify(path)}).default`
}

/** The type of a handler's resolved response, as the client receives it. */
function responseType (handlerFile: string, typesDir: string) {
  return `Serialize<Awaited<ReturnType<${handlerType(handlerFile, typesDir)}>>>`
}

function methodKey (method: string) {
  return method === ALL_METHODS ? 'ALL' : method.toUpperCase()
}

/**
 * Turns collected routes into the input `compileRoutes` takes.
 *
 * The segments are passed through as the builder reported them: the compiler splits a static
 * segment spanning several path segments into one key each, resolves a request whose segment is
 * only known at runtime to the union of the static siblings it could have matched, and matches a
 * catch-all against its own prefix. None of that is Nuxt's to compute.
 */
export function buildServerRoutes (routes: ServerRouteInfo[], typesDir: string, requestTypes?: ServerRequestTypes): Route[] {
  return routes.map((route) => {
    const metadata: Route['metadata'] = {}
    for (const [method, handlers] of Object.entries(route.handlers)) {
      // a single handler describes the request; several answering one method cannot agree on one
      const handler = handlers.length === 1 ? handlerType(handlers[0]!, typesDir) : undefined
      metadata[methodKey(method) as 'ALL'] = {
        responseType: handlers.map(file => responseType(file, typesDir)).join(' | '),
        ...handler && requestTypes?.body ? { bodyType: `${requestTypes.body}<${handler}>` } : {},
        ...handler && requestTypes?.query ? { queryType: `${requestTypes.query}<${handler}>` } : {},
        ...handler && requestTypes?.headers ? { headersType: `${requestTypes.headers}<${handler}>` } : {},
      }
    }
    return { segments: route.segments, metadata }
  })
}

/**
 * Asks the configured `server.builder` for the routes it will serve.
 *
 * The builder is the only authority on this: file-based handlers come from its own scan, and the
 * segments a pattern resolves to are its router's to decide. Without a builder that answers
 * `server:routes` there are no routes to type.
 */
export async function resolveServerRoutes (nuxt: Nuxt): Promise<{ routes: ServerRouteInfo[], requestTypes?: ServerRequestTypes }> {
  const handlers: ServerRouteHandler[] = []
  const context: { requestTypes?: ServerRequestTypes } = {}
  await nuxt.callHook('server:routes', handlers, context)
  return { routes: collectServerRoutes(handlers), requestTypes: context.requestTypes }
}

/**
 * The routes the Vue router serves, as the segments the schema is emitted from.
 *
 * Nitro does not know about the Nuxt renderer, so a path answered by a page is invisible to a
 * schema built from server handlers alone - which is why an unrecognised path has to be accepted
 * unless the app says its routing is enumerable. Including pages closes that gap rather than
 * papering over it: they answer `GET` and return the rendered document.
 *
 * Paths are nested and relative in vue-router unless they start with a slash, so children are
 * joined onto their parent. Optional parameters match with and without the segment, so they
 * contribute two routes, as they do in the server's own router. An alias is served by the router
 * as well as the path it aliases, so it contributes a route of its own.
 */
export function collectPageRoutes (pages: NuxtPage[], parent = ''): ServerRouteHandler[] {
  const handlers: ServerRouteHandler[] = []

  for (const page of pages) {
    const path = page.path.startsWith('/') ? page.path : `${parent}/${page.path}`.replace(/\/+/g, '/')

    if (page.file) {
      const aliases = !page.alias ? [] : typeof page.alias === 'string' ? [page.alias] : page.alias
      for (const aliasPath of [path, ...aliases]) {
        const resolved = aliasPath.startsWith('/') ? aliasPath : `${parent}/${aliasPath}`.replace(/\/+/g, '/')
        for (const route of expandOptionalSegments(resolved)) {
          handlers.push({ segments: toPageSegments(route), route, method: 'get', handler: page.file })
        }
      }
    }
    if (page.children?.length) {
      handlers.push(...collectPageRoutes(page.children, path === '/' ? '' : path))
    }
  }

  return handlers
}

/** A route per combination of the optional parameters in `path`, longest first. */
function expandOptionalSegments (path: string): string[] {
  const index = path.indexOf('?', 1)
  if (index === -1) { return [path || '/'] }

  const withParam = path.replace('?', '')
  const withoutParam = path.slice(0, path.lastIndexOf('/', index)) || '/'
  return [...expandOptionalSegments(withParam), ...expandOptionalSegments(withoutParam)]
}

/** Splits a vue-router path into segments, mapping `:param` and a trailing `*` or `:param(.*)`. */
function toPageSegments (path: string): ServerRouteSegment[] {
  const segments: ServerRouteSegment[] = []

  for (const part of path.split('/')) {
    if (!part) { continue }
    if (part === '*' || /^:.*\(\.\*\)\*?$/.test(part)) {
      segments.push({ type: 'wildcard' })
    } else if (part.startsWith(':')) {
      segments.push({ type: 'dynamic' })
    } else {
      segments.push({ type: 'static', value: `/${part}` })
    }
  }

  return segments.length ? segments : [{ type: 'static', value: '/' }]
}
