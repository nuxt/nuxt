export default {
  dev: (process.env.NODE_ENV !== 'production'),
  buildDir: '.nuxt',
  build: {
    analyze: false,
    extractCSS: false,
    publicPath: '/_nuxt/',
    filenames: {
      css: 'common.[chunkhash].css',
      manifest: 'manifest.[hash].js',
      vendor: 'vendor.bundle.[chunkhash].js',
      app: 'nuxt.bundle.[chunkhash].js'
    },
    vendor: [],
    loaders: [],
    plugins: [],
    babel: {},
    postcss: [],
    templates: [],
    watch: []
  },
  generate: {
    dir: 'dist',
    routes: [],
    interval: 0,
    minify: {
      collapseBooleanAttributes: true,
      collapseWhitespace: true,
      decodeEntities: true,
      minifyCSS: true,
      minifyJS: true,
      processConditionalComments: true,
      removeAttributeQuotes: false,
      removeComments: false,
      removeEmptyAttributes: true,
      removeOptionalTags: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: false,
      removeStyleLinkTypeAttributes: false,
      removeTagWhitespace: false,
      sortAttributes: true,
      sortClassName: true,
      trimCustomFragments: true,
      useShortDoctype: true
    }
  },
  env: {},
  head: {
    meta: [],
    link: [],
    style: [],
    script: []
  },
  plugins: [],
  css: [],
  modules: [],
  layouts: {},
  serverMiddleware: [],
  ErrorPage: null,
  loading: {
    color: 'black',
    failedColor: 'red',
    height: '2px',
    duration: 5000
  },
  transition: {
    name: 'page',
    mode: 'out-in'
  },
  router: {
    mode: 'history',
    base: '/',
    middleware: [],
    linkActiveClass: 'nuxt-link-active',
    linkExactActiveClass: 'nuxt-link-exact-active',
    extendRoutes: null,
    scrollBehavior: null
  },
  render: {
    http2: {
      push: false
    },
    static: {},
    gzip: {
      threshold: 0
    },
    etag: {
      weak: true // Faster for responses > 5KB
    }
  },
  watchers: {
    webpack: {},
    chokidar: {}
  }
}
