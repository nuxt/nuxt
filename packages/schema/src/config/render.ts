import { SchemaDefinition } from 'untyped'

/**
 * @version 2
 */
export default <SchemaDefinition>{
  /**
   * Use this option to customize the Vue SSR bundle renderer.
   * This option is skipped if `ssr: false`.
   *
   * Read [docs for Vue 2](https://ssr.vuejs.org/api/#renderer-options) here.
   */
  bundleRenderer: {
    shouldPrefetch: () => false,
    shouldPreload: (_fileWithoutQuery: string, asType: string) => ['script', 'style'].includes(asType),
    /** enabled by default for development */
    runInNewContext: {
      $resolve: async (val, get) => val ?? (await get('dev'))
    }
  },

  /**
   * Configure the crossorigin attribute on `<link rel="stylesheet">` and `<script>`
   * tags in generated HTML. [More information](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin).
   */
  crossorigin: undefined,

  /**
   * Adds prefetch and preload links for faster initial page load time.
   * You probably don't want to disable this option unless you have many pages and routes.
   */
  resourceHints: true,

  /**
   * Whether to enable rendering of HTML - either dynamically (in server mode) or at generate time.
   *
   * This option is automatically set based on global SSR value if not provided.
   * This can be useful to dynamically enable/disable SSR at runtime after image builds
   * (with docker, for example).
   */
  ssr: undefined,

  /**
   * Forward server-side logs to the browser for better debugging (only available in development).
   *
   * Set to `collapsed` to collapse the logs, or `false` to disable.
   */
  ssrLog: {
    $resolve: async (val, get) => (await get('dev')) ? Boolean(val) : false
  },

  /**
   * Configuration for HTTP2 push headers.
   */
  http2: {
    /** Set to true to enable HTTP2 push headers. */
    push: false,
    /** @deprecated */
    shouldPush: null,
    /**
     * You can control what links to push using this function. It receives `req`,
     * `res`, `publicPath` and a `preloadFiles` array.
     *
     * You can add your own assets to the array as well. Using `req` and `res`
     * you can decide what links to push based on the request headers, for example
     * using the cookie with application version.
     *
     * Assets will be joined together with `,` and passed as a single `Link` header.
     *
     * @example
     * ```js
     * pushAssets: (req, res, publicPath, preloadFiles) =>
     *   preloadFiles
     *     .filter(f => f.asType === 'script' && f.file === 'runtime.js')
     *     .map(f => `<${publicPath}${f.file}>; rel=preload; as=${f.asType}`)
     * ```
     */
    pushAssets: null
  },

  /**
   * Configure the behavior of the `static/` directory.
   *
   * See [serve-static docs](https://github.com/expressjs/serve-static) for possible options.
   */
  static: {
    /**
     * Whether to add the router base to your static assets.
     *
     * @note some URL rewrites might not respect the prefix.
     *
     * @example
     * Assets: favicon.ico
     * Router base: /t
     * With `prefix: true` (default): /t/favicon.ico
     * With `prefix: false`: /favicon.ico
     */
    prefix: true
  },

  /**
   * Configure server compression.
   *
   * Set to `false` to disable compression. You can also pass an object of options
   * for [compression middleware](https://www.npmjs.com/package/compression), or
   * use your own middleware by passing it in directly - for example,
   * `otherComp({ myOptions: 'example' })`.
   *
   * @type {boolean | object | Function}
   */
  compressor: {
    threshold: 0
  },

  /**
   * To disable etag for pages set `etag: false`. See
   * [etag docs](https://github.com/jshttp/etag) for possible options.
   * You can use your own hash function by specifying etag.hash:
   *
   * @example
   * ```js
   * import { murmurHash128 } from 'murmurhash-native'
   *
   * export default {
   *   render: {
   *     etag: {
   *       hash: html => murmurHash128(html)
   *     }
   *   }
   * }
   * ```
   * In this example we are using `murmurhash-native`, which is faster
   * for larger HTML body sizes. Note that the weak option is ignored
   * when specifying your own hash function.
   */
  etag: {
    hash: false,
    weak: false
  },

  /**
   * Use this to configure Content-Security-Policy to load external resources. [Read more](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).
   *
   * Set to `true` to enable, or you can pass options to fine-tune your CSP options.
   *
   * **Prerequisites**:
   * These CSP settings are only effective when using Nuxt with `mode: 'server'`
   * to serve your SSR application.
   *
   * **Updating settings**:
   * These settings are read by the Nuxt server directly from `nuxt.config`.
   * This means changes to these settings take effect when the server is restarted.
   * There is no need to rebuild the application to update CSP settings.
   *
   * @example
   * ```js
   * export default {
   *   render: {
   *     csp: {
   *       hashAlgorithm: 'sha256',
   *       policies: {
   *         'script-src': [
   *           'https://www.google-analytics.com',
   *           'https://name.example.com'
   *         ],
   *         'report-uri': ['https://report.example.com/report-csp-violations']
   *       },
   *       addMeta: true
   *     }
   *   }
   * }
   * ```
   *
   * The following example allows Google Analytics, LogRocket.io, and Sentry.io
   * for logging and analytic tracking.
   *
   * Review [this blog on Sentry.io](https://blog.sentry.io/2018/09/04/how-sentry-captures-csp-violations)
   * to learn what tracking link you should use.
   * @example
   * ```js
   * // PRIMARY_HOSTS = `loc.example-website.com`
   * export default {
   *   render: {
   *     csp: {
   *       reportOnly: true,
   *       hashAlgorithm: 'sha256',
   *       policies: {
   *         'default-src': ["'self'"],
   *         'img-src': ['https:', '*.google-analytics.com'],
   *         'worker-src': ["'self'", `blob:`, PRIMARY_HOSTS, '*.logrocket.io'],
   *         'style-src': ["'self'", "'unsafe-inline'", PRIMARY_HOSTS],
   *         'script-src': [
   *           "'self'",
   *           "'unsafe-inline'",
   *           PRIMARY_HOSTS,
   *           'sentry.io',
   *           '*.sentry-cdn.com',
   *           '*.google-analytics.com',
   *           '*.logrocket.io'
   *         ],
   *         'connect-src': [PRIMARY_HOSTS, 'sentry.io', '*.google-analytics.com'],
   *         'form-action': ["'self'"],
   *         'frame-ancestors': ["'none'"],
   *         'object-src': ["'none'"],
   *         'base-uri': [PRIMARY_HOSTS],
   *         'report-uri': [
   *           `https://sentry.io/api/<project>/security/?sentry_key=<key>`
   *         ]
   *       }
   *     }
   *   }
   * }
   * ```
   */
  csp: {
    $resolve: async (val, get) => {
      if (!val) { return false }
      return {
        hashAlgorithm: 'sha256',
        allowedSources: undefined,
        /** Policies to be added to the response `Content-Security-Policy` HTTP header. */
        policies: undefined,
        /**
         * Whether to add `<meta http-equiv="Content-Security-Policy"/>` to the `<head>`.
         * This is independent of the `csp.policies` configuration and the complete set
         * of the defined policies will still be added to the HTTP response header.
         *
         * @note CSP hashes will not be added as `<meta>` if `script-src` policy
         * contains 'unsafe-inline'. This is due to browsers ignoring 'unsafe-inline'
         * if hashes are present. (Set option `unsafeInlineCompatibility` to true to
         * disable this behavior.)
         */
        addMeta: Boolean((await get('target')) === 'static'),
        /**
         * Set option `unsafeInlineCompatibility` to `true` if you want both hashes and
         * 'unsafe-inline' for CSPv1 compatibility. In that case the `<meta>` tag will
         * still only contain the hashes of the inline `<script>` tags, and the policies
         * defined under `csp.policies` will be used in the `Content-Security-Policy`
         * HTTP response header.
         */
        unsafeInlineCompatibility: false,
        reportOnly: (await get('debug')),
        ...val
      }
    }
  },

  /**
   * Options used for serving distribution files. Only applicable in production.
   *
   * See [serve-static docs](https://www.npmjs.com/package/serve-static) for possible options.
   */
  dist: {
    index: false,
    maxAge: '1y'
  },

  /**
   * Configure fallback behavior for [`serve-placeholder` middleware](https://github.com/nuxt/serve-placeholder).
   *
   * Example of allowing `.js` extension for routing (for example, `/repos/nuxt.js`):
   *
   * @example
   * ```js
   * export default {
   *   render: {
   *     fallback: {
   *       static: {
   *         // Avoid sending 404 for these extensions
   *         handlers: {
   *           '.js': false
   *         }
   *       }
   *     }
   *   }
   * }
   * ```
   */
  fallback: {
    /**
     * For routes matching the publicPath (`/_nuxt/*`).
     * Disable by setting to `false`.
     */
    dist: {},

    /**
     * For all other routes (`/*`).
     * Disable by setting to `false`.
     */
    static: {
      skipUnknown: true,
      handlers: {
        '.htm': false,
        '.html': false
      }
    }
  }
}
