import _ from 'lodash'
import { join, resolve } from 'path'
import { existsSync } from 'fs'
import { isUrl, isPureObject } from 'utils'

const Options = {}

export default Options

Options.from = function (_options) {
  // Clone options to prevent unwanted side-effects
  const options = Object.assign({}, _options)

  // Normalize options
  if (options.loading === true) {
    delete options.loading
  }
  if (options.router && typeof options.router.middleware === 'string') {
    options.router.middleware = [options.router.middleware]
  }
  if (options.router && typeof options.router.base === 'string') {
    options._routerBaseSpecified = true
  }
  if (typeof options.transition === 'string') {
    options.transition = { name: options.transition }
  }

  // Apply defaults
  _.defaultsDeep(options, Options.defaults)

  // Resolve dirs
  const hasValue = v => typeof v === 'string' && v
  options.rootDir = hasValue(options.rootDir) ? options.rootDir : process.cwd()
  options.srcDir = hasValue(options.srcDir) ? resolve(options.rootDir, options.srcDir) : options.rootDir
  options.modulesDir = resolve(options.rootDir, hasValue(options.modulesDir) ? options.modulesDir : 'node_modules')
  options.buildDir = resolve(options.rootDir, options.buildDir)
  options.cacheDir = resolve(options.rootDir, options.cacheDir)

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
  if (options.store !== false && existsSync(join(options.srcDir, 'store'))) {
    options.store = true
  }

  // Normalize loadingIndicator
  if (!isPureObject(options.loadingIndicator)) {
    options.loadingIndicator = { name: options.loadingIndicator }
  }

  // Apply defaults to loadingIndicator
  options.loadingIndicator = Object.assign({
    name: 'pulse',
    color: '#dbe1ec',
    background: 'white'
  }, options.loadingIndicator)

  // cssSourceMap
  if (options.build.cssSourceMap === undefined) {
    options.build.cssSourceMap = options.dev
  }

  // Postcss
  // 1. Check if it is explicitly disabled by false value
  // ... Disable all postcss loaders
  // 2. Check if any standard source of postcss config exists
  // ... Make postcss = true letting loaders find this kind of config
  // 3. Else (Easy Usage)
  // ... Auto merge it with defaults
  if (options.build.postcss !== false) {
    // Detect postcss config existence
    // https://github.com/michael-ciniawsky/postcss-load-config
    let postcssConfigExists = false
    for (let dir of [options.srcDir, options.rootDir]) {
      for (let file of ['postcss.config.js', '.postcssrc.js', '.postcssrc', '.postcssrc.json', '.postcssrc.yaml']) {
        if (existsSync(resolve(dir, file))) {
          postcssConfigExists = true
          break
        }
      }
      if (postcssConfigExists) break
    }

    // Default postcss options
    if (postcssConfigExists) {
      options.build.postcss = true
    }

    // Normalize & Apply default plugins
    if (Array.isArray(options.build.postcss)) {
      options.build.postcss = { plugins: options.build.postcss }
    }
    if (isPureObject(options.build.postcss)) {
      options.build.postcss = Object.assign({
        sourceMap: options.build.cssSourceMap,
        plugins: {
          // https://github.com/postcss/postcss-import
          'postcss-import': {
            root: options.rootDir,
            path: [
              options.srcDir,
              options.rootDir,
              options.modulesDir
            ]
          },
          // https://github.com/postcss/postcss-url
          'postcss-url': {},
          // http://cssnext.io/postcss
          'postcss-cssnext': {}
        }
      }, options.build.postcss)
    }
  }

  // Debug errors
  if (options.debug === undefined) {
    options.debug = options.dev
  }

  // Apply mode preset
  let modePreset = Options.modes[options.mode || 'universal'] || Options.modes['universal']
  _.defaultsDeep(options, modePreset)

  // If no server-side rendering, add appear true transition
  if (options.render.ssr === false) {
    options.transition.appear = true
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

Options.defaults = {
  mode: 'universal',
  dev: process.env.NODE_ENV !== 'production',
  debug: undefined, // Will be equal to dev if not provided
  buildDir: '.nuxt',
  cacheDir: '.cache',
  nuxtAppDir: resolve(__dirname, '../lib/app/'), // Relative to dist
  build: {
    analyze: false,
    dll: false,
    extractCSS: false,
    cssSourceMap: undefined,
    ssr: undefined,
    publicPath: '/_nuxt/',
    filenames: {
      css: 'common.[contenthash].css',
      manifest: 'manifest.[hash].js',
      vendor: 'common.[chunkhash].js',
      app: 'app.[chunkhash].js',
      chunk: '[name].[chunkhash].js'
    },
    vendor: [],
    plugins: [],
    babel: {},
    postcss: {},
    templates: [],
    watch: [],
    devMiddleware: {},
    hotMiddleware: {}
  },
  generate: {
    dir: 'dist',
    routes: [],
    concurrency: 500,
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
  router: {
    mode: 'history',
    base: '/',
    routes: [],
    middleware: [],
    linkActiveClass: 'nuxt-link-active',
    linkExactActiveClass: 'nuxt-link-exact-active',
    extendRoutes: null,
    scrollBehavior: null,
    fallback: false
  },
  render: {
    bundleRenderer: {},
    resourceHints: true,
    ssr: undefined,
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
    webpack: {
      ignored: /-dll/
    },
    chokidar: {}
  },
  messages: {
    error_404: 'This page could not be found',
    server_error: 'Server error',
    nuxtjs: 'Nuxt.js',
    back_to_home: 'Back to the home page',
    server_error_details: 'An error occurred in the application and your page could not be served. If you are the application owner, check your logs for details.',
    client_error: 'Error',
    client_error_details: 'An error occurred while rendering the page. Check developer tools console for details.'
  }
}
