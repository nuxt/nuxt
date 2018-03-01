const _ = require('lodash')
const Debug = require('debug')
const { join, resolve } = require('path')
const { existsSync, readdirSync } = require('fs')
const { isUrl, isPureObject } = require('../common/utils')

const debug = Debug('nuxt:build')
debug.color = 2 // Force green color

const Options = {}

module.exports = Options

Options.from = function (_options) {
  // Clone options to prevent unwanted side-effects
  const options = Object.assign({}, _options)

  // Normalize options
  if (options.loading === true) {
    delete options.loading
  }
  if (
    options.router &&
    options.router.middleware &&
    !Array.isArray(options.router.middleware)
  ) {
    options.router.middleware = [options.router.middleware]
  }
  if (options.router && typeof options.router.base === 'string') {
    options._routerBaseSpecified = true
  }
  if (typeof options.transition === 'string') {
    options.transition = { name: options.transition }
  }
  if (typeof options.layoutTransition === 'string') {
    options.layoutTransition = { name: options.layoutTransition }
  }
  if (typeof options.extensions === 'string') {
    options.extensions = [options.extensions]
  }

  const hasValue = v => typeof v === 'string' && v
  options.rootDir = hasValue(options.rootDir) ? options.rootDir : process.cwd()

  // Apply defaults by ${buildDir}/dist/build.config.js
  // TODO: Unsafe operation.
  // const buildDir = options.buildDir || Options.defaults.buildDir
  // const buildConfig = resolve(options.rootDir, buildDir, 'build.config.js')
  // if (existsSync(buildConfig)) {
  //   _.defaultsDeep(options, require(buildConfig))
  // }

  // Apply defaults
  _.defaultsDeep(options, Options.defaults)

  // Resolve dirs
  options.srcDir = hasValue(options.srcDir)
    ? resolve(options.rootDir, options.srcDir)
    : options.rootDir
  options.buildDir = resolve(options.rootDir, options.buildDir)
  options.cacheDir = resolve(options.rootDir, options.cacheDir)

  // Populate modulesDir
  options.modulesDir = []
    .concat(options.modulesDir)
    .concat(join(options.nuxtDir, 'node_modules'))
    .filter(dir => hasValue(dir))
    .map(dir => resolve(options.rootDir, dir))

  // Sanitize extensions
  if (options.extensions.indexOf('js') === -1) {
    options.extensions.unshift('js')
  }

  // If app.html is defined, set the template path to the user template
  options.appTemplatePath = resolve(options.buildDir, 'views/app.template.html')
  if (existsSync(join(options.srcDir, 'app.html'))) {
    options.appTemplatePath = join(options.srcDir, 'app.html')
  }

  // Ignore publicPath on dev
  /* istanbul ignore if */
  if (options.dev && isUrl(options.build.publicPath)) {
    options.build.publicPath = Options.defaults.build.publicPath
  }

  // If store defined, update store options to true unless explicitly disabled
  if (
    options.store !== false &&
    existsSync(join(options.srcDir, options.dir.store)) &&
    readdirSync(join(options.srcDir, options.dir.store))
      .find(filename => filename !== 'README.md' && filename[0] !== '.')
  ) {
    options.store = true
  }

  // Normalize loadingIndicator
  if (!isPureObject(options.loadingIndicator)) {
    options.loadingIndicator = { name: options.loadingIndicator }
  }

  // Apply default hash to CSP option
  if (options.render.csp === true) {
    options.render.csp = { hashAlgorithm: 'sha256' }
  }

  // Apply defaults to loadingIndicator
  options.loadingIndicator = Object.assign(
    {
      name: 'pulse',
      color: '#dbe1ec',
      background: 'white'
    },
    options.loadingIndicator
  )

  // cssSourceMap
  if (options.build.cssSourceMap === undefined) {
    options.build.cssSourceMap = options.dev
  }

  // Debug errors
  if (options.debug === undefined) {
    options.debug = options.dev
  }

  // Normalize ignore
  options.ignore = options.ignore ? [].concat(options.ignore) : []

  // Append ignorePrefix glob to ignore
  if (typeof options.ignorePrefix === 'string') {
    options.ignore.push(`**/${options.ignorePrefix}*.*`)
  }

  // Apply mode preset
  let modePreset =
    Options.modes[options.mode || 'universal'] || Options.modes['universal']
  _.defaultsDeep(options, modePreset)

  // If no server-side rendering, add appear true transition
  /* istanbul ignore if */
  if (options.render.ssr === false && options.transition) {
    options.transition.appear = true
  }

  // We assume the SPA fallback path is 404.html (for GitHub Pages, Surge, etc.)
  if (options.generate.fallback === true) {
    options.generate.fallback = '404.html'
  }

  return options
}

Options.modes = {
  universal: {
    build: {
      ssr: true
    },
    render: {
      ssr: true
    }
  },
  spa: {
    build: {
      ssr: false
    },
    render: {
      ssr: false
    }
  }
}

// Options.unsafeKeys = [
//   'rootDir', 'srcDir', 'buildDir', 'modulesDir', 'cacheDir', 'nuxtDir',
//   'nuxtAppDir', 'build', 'generate', 'router.routes', 'appTemplatePath'
// ]

Options.defaults = {
  mode: 'universal',
  dev: process.env.NODE_ENV !== 'production',
  debug: undefined, // Will be equal to dev if not provided
  buildDir: '.nuxt',
  cacheDir: '.cache',
  nuxtDir: resolve(__dirname, '../..'),
  nuxtAppDir: resolve(__dirname, '../app'),
  modulesDir: ['node_modules'], // ~> relative to options.rootDir
  ignorePrefix: '-',
  ignore: [
    '**/*.test.*'
  ],
  extensions: [],
  build: {
    analyze: false,
    profile: process.argv.includes('--profile'),
    dll: false,
    scopeHoisting: false,
    maxChunkSize: false,
    extractCSS: false,
    cssSourceMap: undefined,
    ssr: undefined,
    uglify: {},
    publicPath: '/_nuxt/',
    filenames: {
      css: '[name].[contenthash].css',
      manifest: 'manifest.[hash].js',
      vendor: 'vendor.[chunkhash].js',
      app: '[name].[chunkhash].js',
      chunk: '[name].[chunkhash].js'
    },
    styleResources: {},
    vendor: [],
    plugins: [],
    babel: {},
    postcss: {},
    templates: [],
    watch: [],
    devMiddleware: {},
    hotMiddleware: {},
    stats: {
      chunks: false,
      children: false,
      modules: false,
      colors: true,
      excludeAssets: [
        /.map$/,
        /index\..+\.html$/,
        /vue-ssr-client-manifest.json/
      ]
    }
  },
  generate: {
    dir: 'dist',
    routes: [],
    concurrency: 500,
    interval: 0,
    subFolders: true,
    fallback: '200.html',
    minify: {
      collapseBooleanAttributes: true,
      collapseWhitespace: false,
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
      sortClassName: false,
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
    duration: 5000,
    rtl: false
  },
  loadingIndicator: {},
  transition: {
    name: 'page',
    mode: 'out-in',
    appear: false,
    appearClass: 'appear',
    appearActiveClass: 'appear-active',
    appearToClass: 'appear-to'
  },
  layoutTransition: {
    name: 'layout',
    mode: 'out-in'
  },
  dir: {
    assets: 'assets',
    layouts: 'layouts',
    middleware: 'middleware',
    pages: 'pages',
    static: 'static',
    store: 'store'
  },
  router: {
    mode: 'history',
    base: '/',
    routes: [],
    middleware: [],
    linkActiveClass: 'nuxt-link-active',
    linkExactActiveClass: 'nuxt-link-exact-active',
    extendRoutes: null,
    scrollBehavior: null,
    parseQuery: false,
    stringifyQuery: false,
    fallback: false
  },
  render: {
    bundleRenderer: {},
    resourceHints: true,
    ssr: undefined,
    http2: {
      push: false,
      shouldPush: null
    },
    static: {
      prefix: true
    },
    gzip: {
      threshold: 0
    },
    etag: {
      weak: false
    },
    csp: {
      enabled: false,
      hashAlgorithm: 'sha256',
      allowedSources: undefined,
      policies: undefined
    }
  },
  watchers: {
    webpack: {
      ignored: /-dll/
    },
    chokidar: {}
  },
  editor: undefined,
  hooks: null,
  messages: {
    error_404: 'This page could not be found',
    server_error: 'Server error',
    nuxtjs: 'Nuxt.js',
    back_to_home: 'Back to the home page',
    server_error_details:
      'An error occurred in the application and your page could not be served. If you are the application owner, check your logs for details.',
    client_error: 'Error',
    client_error_details:
      'An error occurred while rendering the page. Check developer tools console for details.'
  }
}
