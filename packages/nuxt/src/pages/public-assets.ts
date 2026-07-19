import { joinURL, withLeadingSlash, withoutTrailingSlash } from 'ufo'
import type { NuxtPage } from 'nuxt/schema'

const INDEX_HTML_SUFFIX = '/index.html'

export function normalizeRoute (path: string) {
  return withoutTrailingSlash(withLeadingSlash(path)) || '/'
}

/**
 * Map static page routes and aliases to their source files.
 * Dynamic routes are intentionally excluded to avoid noisy warnings.
 */
export function collectStaticPageRoutes (pages: NuxtPage[], parent = '/', routes = new Map<string, string | undefined>()) {
  for (const page of pages) {
    const route = normalizeRoute(joinURL(parent, page.path))

    if (!route.includes(':')) {
      routes.set(route, page.file)
    }

    const aliases = Array.isArray(page.alias) ? page.alias : page.alias ? [page.alias] : []
    for (const alias of aliases) {
      const resolved = normalizeRoute(alias.startsWith('/') ? alias : joinURL(parent, alias))
      if (!resolved.includes(':')) {
        routes.set(resolved, page.file)
      }
    }

    if (page.children) {
      collectStaticPageRoutes(page.children, route, routes)
    }
  }

  return routes
}

/**
 * Return asset paths that Nitro can serve for a route, relative to the asset directory.
 */
export function getAssetPathsForRoute (route: string, baseURL = '/') {
  const base = normalizeRoute(baseURL)

  if (base !== '/' && route !== base && !route.startsWith(base + '/')) {
    return undefined
  }

  const relativeRoute = route.slice(base === '/' ? 1 : base.length + 1)

  return relativeRoute
    ? [relativeRoute, relativeRoute + INDEX_HTML_SUFFIX]
    : [INDEX_HTML_SUFFIX.slice(1)]
}
