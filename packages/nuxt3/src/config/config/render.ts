// TODO: Refactor @nuxt/server related options into `server.js`

export default () => ({
  bundleRenderer: {
    shouldPrefetch: () => false,
    shouldPreload: (fileWithoutQuery, asType) => ['script', 'style'].includes(asType),
    runInNewContext: undefined
  },
  crossorigin: undefined,
  resourceHints: true,
  ssr: undefined,
  ssrLog: undefined,
  http2: {
    push: false,
    shouldPush: null,
    pushAssets: null
  },
  static: {
    prefix: true
  },
  compressor: {
    threshold: 0
  },
  etag: {
    weak: false
  },
  csp: false,
  dist: {
    // Don't serve index.html template
    index: false,
    // 1 year in production
    maxAge: '1y'
  },
  // https://github.com/nuxt/serve-placeholder
  fallback: {
    dist: {},
    static: {
      skipUnknown: true,
      handlers: {
        '.htm': false,
        '.html': false
      }
    }
  }
})
