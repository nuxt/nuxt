import { normalizeURL, withTrailingSlash } from 'ufo'

export default {
  mode: 'history',
  base: {
    $resolve: (val = '/') => withTrailingSlash(normalizeURL(val))
  },
  _routerBaseSpecified: {
    $resolve: (_val, get) => typeof get('router.base') === 'string'
  },
  routes: [],
  routeNameSplitter: '-',
  middleware: {
    $resolve: val => Array.isArray(val) ? val : [val].filter(Boolean)
  },
  linkActiveClass: 'nuxt-link-active',
  linkExactActiveClass: 'nuxt-link-exact-active',
  linkPrefetchedClass: false,
  extendRoutes: null,
  scrollBehavior: {
    $schema: {
      deprecated: 'router.scrollBehavior` property is deprecated in favor of using `~/app/router.scrollBehavior.js` file, learn more: https://nuxtjs.org/api/configuration-router#scrollbehavior'
    }
  },
  parseQuery: false,
  stringifyQuery: false,
  fallback: false,
  prefetchLinks: true,
  prefetchPayloads: true,
  trailingSlash: undefined
}
