export default {
  bundleRenderer: {
    shouldPrefetch: () => false,
    shouldPreload: (_fileWithoutQuery, asType) => ['script', 'style'].includes(asType),
    /**
     * enabled by default for development
     */
    runInNewContext: { $resolve: (val, get) => val ?? get('dev') }
  },
  crossorigin: undefined,
  resourceHints: true,
  ssr: undefined,
  ssrLog: { $resolve: (val, get) => get('dev') ? Boolean(val) : false },
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
    hash: false,
    weak: false
  },
  csp: {
    $resolve: (val, get) => {
      if (!val) { return false }
      return {
        hashAlgorithm: 'sha256',
        allowedSources: undefined,
        policies: undefined,
        addMeta: Boolean(get('target') === 'static'),
        unsafeInlineCompatibility: false,
        reportOnly: get('debug'),
        ...val
      }
    }
  },
  dist: {
    index: false,
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
}
