import { normalizeURL, withTrailingSlash } from 'ufo'

export default {
  /**
   * Configure the router mode.
   *
   * For server-side rendering it is not recommended to change it./**
   * @version 2
   */
  mode: 'history',

  /**
   * The base URL of the app. For example, if the entire single page application is
   * served under /app/, then base should use the value '/app/'.
   *
   * This can be useful if you need to serve Nuxt as a different context root, from
   * within a bigger web site.
   * @version 2
   * @version 3
   */
  base: {
    $resolve: (val = '/') => withTrailingSlash(normalizeURL(val))
  },

  /** @private */
  _routerBaseSpecified: {
    $resolve: (_val, get) => typeof get('router.base') === 'string'
  },

  /** @version 2 */
  routes: [],

  /**
   * This allows changing the separator between route names that Nuxt uses.
   *
   * Imagine we have the page file `pages/posts/_id.vue`. Nuxt will generate the
   * route name programmatically, in this case `posts-id`. If you change the routeNameSplitter
   * config to `/` the name will change to `posts/id`.
   * @version 2
   */
  routeNameSplitter: '-',

  /**
   * Set the default(s) middleware for every page of the application.
   * @version 2
   */
  middleware: {
    $resolve: val => Array.isArray(val) ? val : [val].filter(Boolean)
  },

  /**
   * Globally configure `<nuxt-link>` default active class.
   * @version 2
   */
  linkActiveClass: 'nuxt-link-active',

  /**
   * Globally configure `<nuxt-link>` default exact active class.
   * @version 2
   */
  linkExactActiveClass: 'nuxt-link-exact-active',

  /**
   * Globally configure `<nuxt-link>` default prefetch class (feature disabled by default)
   * @version 2
   */
  linkPrefetchedClass: false,

  /**
   * You can pass a function to extend the routes created by Nuxt.
   *
   * @example
   * ```js
   * export default {
   *   router: {
   *     extendRoutes(routes, resolve) {
   *       routes.push({
   *         name: 'custom',
   *         path: '*',
   *         component: resolve(__dirname, 'pages/404.vue')
   *       })
   *     }
   *   }
   * }
   * ```
   * @version 2
   */
  extendRoutes: null,

  /**
   * The `scrollBehavior` option lets you define a custom behavior for the scroll
   * position between the routes. This method is called every time a page is
   * rendered. To learn more about it.
   *
   * @see [vue-router `scrollBehavior` documentation](https://router.vuejs.org/guide/advanced/scroll-behavior.html)
   * @version 2
   */
  scrollBehavior: {
    $schema: {
      deprecated: 'router.scrollBehavior` property is deprecated in favor of using `~/app/router.scrollBehavior.js` file, learn more: https://nuxtjs.org/api/configuration-router#scrollbehavior'
    }
  },

  /**
   * Provide custom query string parse function. Overrides the default.
   * @version 2
   */
  parseQuery: false,

  /**
   * Provide custom query string stringify function. Overrides the default.
   * @version 2
   */
  stringifyQuery: false,

  /**
   * Controls whether the router should fall back to hash mode when the browser
   * does not support history.pushState but mode is set to history.
   *
   * Setting this to false essentially makes every router-link navigation a full
   * page refresh in IE9. This is useful when the app is server-rendered and needs
   * to work in IE9, because a hash mode URL does not work with SSR.
   * @version 2
   */
  fallback: false,

  /**
   * Configure `<nuxt-link>` to prefetch the code-splitted page when detected within
   * the viewport. Requires [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) to be supported (see [Caniuse](https://caniuse.com/intersectionobserver)).
   * @version 2
   */
  prefetchLinks: true,

  /**
   * When using nuxt generate with target: 'static', Nuxt will generate a
   * payload.js for each page.
   *
   * With this option enabled, Nuxt will automatically prefetch the payload of the
   * linked page when the `<nuxt-link>` is visible in the viewport, making instant navigation.
   * @version 2
   */
  prefetchPayloads: true,

  /**
   * If this option is set to true, trailing slashes will be appended to every
   * route. If set to false, they'll be removed.
   *
   * @warning This option should not be set without preparation and has to
   * be tested thoroughly. When setting `trailingSlash` to something else than
   * undefined, the opposite route will stop working. Thus 301 redirects should
   * be in place and your internal linking has to be adapted correctly. If you set
   * `trailingSlash` to true, then only example.com/abc/ will work but not
   * example.com/abc. On false, it's vice-versa
   * @version 2
   */
  trailingSlash: undefined
}
