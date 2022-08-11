import { resolve } from 'pathe'
import { joinURL } from 'ufo'

/**
 * @version 2
 */
export default {
  /**
   * Directory name that holds all the assets and generated pages for a `static` build.
   */
  dir: {
    $resolve: (val = 'dist', get) => resolve(get('rootDir'), val)
  },

  /**
   * The routes to generate.
   *
   * If you are using the crawler, this will be only the starting point for route generation.
   * This is often necessary when using dynamic routes.
   *
   * It can be an array or a function.
   *
   * @example
   * ```js
   * routes: ['/users/1', '/users/2', '/users/3']
   * ```
   *
   * You can pass a function that returns a promise or a function that takes a callback. It should
   * return an array of strings or objects with `route` and (optional) `payload` keys.
   *
   * @example
   * ```js
   * export default {
   *   generate: {
   *     async routes() {
   *       const res = await axios.get('https://my-api/users')
   *       return res.data.map(user => ({ route: '/users/' + user.id, payload: user }))
   *     }
   *   }
   * }
   * ```
   * Or instead:
   * ```js
   * export default {
   *   generate: {
   *     routes(callback) {
   *       axios
   *         .get('https://my-api/users')
   *         .then(res => {
   *           const routes = res.data.map(user => '/users/' + user.id)
   *           callback(null, routes)
   *         })
   *         .catch(callback)
   *     }
   *   }
   * }
   * ```
   *
   * If `routes()` returns a payload, it can be accessed from the Nuxt context.
   * @example
   * ```js
   * export default {
   *   async useAsyncData ({ params, error, payload }) {
   *     if (payload) return { user: payload }
   *     else return { user: await backend.fetchUser(params.id) }
   *   }
   * }
   * ```
   */
  routes: [],

  /**
   * An array of string or regular expressions that will prevent generation
   * of routes matching them. The routes will still be accessible when `fallback` is set.
   */
  exclude: [],

  /** The number of routes that are generated concurrently in the same thread. */
  concurrency: 500,

  /**
   * Interval in milliseconds between two render cycles to avoid flooding a potential
   * API with calls.
   */
  interval: 0,

  /**
   * Set to `false` to disable creating a directory + `index.html` for each route.
   *
   * @example
   * ```bash
   * # subFolders: true
   * -| dist/
   * ---| index.html
   * ---| about/
   * -----| index.html
   * ---| products/
   * -----| item/
   * -------| index.html
   *
   * # subFolders: false
   * -| dist/
   * ---| index.html
   * ---| about.html
   * ---| products/
   * -----| item.html
   * ```
   */
  subFolders: true,

  /**
   * The path to the fallback HTML file.
   *
   * Set this as the error page in your static server configuration, so that unknown
   * routes can be rendered (on the client-side) by Nuxt.
   *
   * * If unset or set to a falsy value, the name of the fallback HTML file will be `200.html`.
   * * If set to `true`, the filename will be `404.html`.
   * * If you provide a string as a value, it will be used instead.
   *
   * @note Multiple services (e.g. Netlify) detect a `404.html` automatically. If
   * you configure your web server on your own, please consult its documentation
   * to find out how to set up an error page (and set it to the `404.html` file).
   */
  fallback: { $resolve: val => val === true ? '400.html' : (val || '200.html') },

  /**
   * Set to `false` to disable generating pages discovered through crawling relative
   * links in generated pages.
   */
  crawler: true,

  /** Set to `false` to disable generating a `manifest.js` with a list of all generated pages. */
  manifest: true,

  /** Set to `false` to disable generating a `.nojekyll` file (which aids compatibility with GitHub Pages). */
  nojekyll: true,

  /**
   * Configure the cache (used with `static` target to avoid rebuilding when no files have changed).
   *
   * Set to `false` to disable completely.
   */
  cache: {
    /** An array of files or directories to ignore. (It can also be a function that returns an array.) */
    ignore: [],
    /**
     * Options to pass to [`globby`](https://github.com/sindresorhus/globby), which
     * is used to generate a 'snapshot' of the source files.
     */
    globbyOptions: {
      gitignore: true
    }
  },

  staticAssets: {
    /** The directory underneath `/_nuxt/`, where static assets (payload, state and manifest files) will live. */
    dir: 'static',
    /**
     * The full path to the directory underneath `/_nuxt/` where static assets
     * (payload, state and manifest files) will live.
     */
    base: { $resolve: (val, get) => val || joinURL(get('app').buildAssetsDir, get('generate.dir')) },
    /** The full path to the versioned directory where static assets for the current buidl are located. */
    versionBase: { $resolve: (val, get) => val || joinURL(get('generate.base'), get('generate.version')) },
    /** A unique string to uniquely identify payload versions (defaults to the current timestamp).  */
    version: { $resolve: val => val || (String(Math.round(Date.now() / 1000))) }
  }
}
