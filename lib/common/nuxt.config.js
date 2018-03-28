import path from 'path'
import fs from 'fs'

import isCI from 'is-ci'

const nuxtDir = fs.existsSync(path.resolve(__dirname, '..', 'package.json'))
  ? path.resolve(__dirname, '..') // dist
  : path.resolve(__dirname, '..', '..') // src

export default {
  // Information about running environment
  dev: process.env.NODE_ENV !== 'production',
  production: process.env.NODE_ENV === 'production',
  debug: undefined, // = dev
  test: process.env.NODE_ENV === 'test',
  ci: Boolean(isCI),
  tty: Boolean(process.stdout.isTTY),
  minimalCLI: undefined, // = ci || test || production || !tty

  // Mode
  mode: 'universal',

  // Dirs
  buildDir: '.nuxt',
  cacheDir: '.cache',
  nuxtDir,
  nuxtAppDir: path.resolve(nuxtDir, 'lib', 'app'),
  modulesDir: ['node_modules'], // ~> relative to options.rootDir

  // Ignore
  ignorePrefix: '-',
  ignore: [
    '**/*.test.*'
  ],

  extensions: [],

  build: {
    analyze: false,
    profile: process.argv.includes('--profile'),
    maxChunkSize: false,
    extractCSS: false,
    cssSourceMap: undefined,
    ssr: undefined,
    parallel: false,
    cache: false,
    publicPath: '/_nuxt/',
    filenames: {
      app: '[name].[chunkhash].js',
      chunk: '[name].[chunkhash].js',
      // TODO: Use [name].[contenthash].css
      // When this merge released: https://github.com/webpack/webpack/pull/6839
      css: '[name].[chunkhash].css'
    },
    styleResources: {},
    plugins: [],
    optimization: {
      splitChunks: {
        chunks: 'all',
        automaticNameDelimiter: '.',
        cacheGroups: {}
      }
    },
    splitChunks: {
      layouts: false,
      pages: true,
      commons: true
    },
    babel: {
      babelrc: false
    },
    vueLoader: {},
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
      warnings: true,
      errors: true,
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
  loadingIndicator: 'default',
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
    bundleRenderer: {
      shouldPrefetch: () => false
    },
    resourceHints: undefined,
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
    webpack: {},
    chokidar: {}
  },
  editor: undefined,
  hooks: null,
  messages: {
    loading: 'Loading...',
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
