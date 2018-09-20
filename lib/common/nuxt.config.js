import path from 'path'
import fs from 'fs'
import env from 'std-env'

const nuxtDir = fs.existsSync(path.resolve(__dirname, '..', 'package.json'))
  ? path.resolve(__dirname, '..') // dist
  : path.resolve(__dirname, '..', '..') // src

export default {
  // Information about running environment
  dev: Boolean(env.dev),
  debug: undefined, // = dev

  // Mode
  mode: 'universal',

  // Server options
  server: {
    https: false,
    port: process.env.NUXT_PORT ||
      process.env.PORT ||
      process.env.npm_package_config_nuxt_port,
    host: process.env.NUXT_HOST ||
      process.env.HOST ||
      process.env.npm_package_config_nuxt_host
  },

  // Dirs
  srcDir: undefined,
  buildDir: '.nuxt',
  nuxtDir,
  nuxtAppDir: path.resolve(nuxtDir, 'lib', 'app'),
  modulesDir: ['node_modules'], // ~> relative to options.rootDir

  // Ignore
  ignorePrefix: '-',
  ignore: [
    '**/*.test.*',
    '**/*.spec.*'
  ],

  extensions: [],

  build: {
    quiet: Boolean(env.ci || env.test),
    analyze: false,
    profile: process.argv.includes('--profile'),
    extractCSS: false,
    cssSourceMap: undefined,
    ssr: undefined,
    parallel: false,
    cache: false,
    publicPath: '/_nuxt/',
    filenames: {
      // { isDev, isClient, isServer }
      app: ({ isDev }) => isDev ? '[name].js' : '[chunkhash].js',
      chunk: ({ isDev }) => isDev ? '[name].js' : '[chunkhash].js',
      css: ({ isDev }) => isDev ? '[name].js' : '[contenthash].css',
      img: ({ isDev }) => isDev ? '[path][name].[ext]' : 'img/[hash:7].[ext]',
      font: ({ isDev }) => isDev ? '[path][name].[ext]' : 'fonts/[hash:7].[ext]',
      video: ({ isDev }) => isDev ? '[path][name].[ext]' : 'videos/[hash:7].[ext]'
    },
    loaders: {
      file: {},
      fontUrl: { limit: 1000 },
      imgUrl: { limit: 1000 },
      pugPlain: {},
      vue: {
        transformAssetUrls: {
          video: 'src',
          source: 'src',
          object: 'src',
          embed: 'src'
        }
      },
      css: {},
      cssModules: {
        localIdentName: '[local]_[hash:base64:5]'
      },
      less: {},
      sass: {
        indentedSyntax: true
      },
      scss: {},
      stylus: {},
      vueStyle: {}
    },
    styleResources: {},
    plugins: [],
    optimization: {
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
        automaticNameDelimiter: '.',
        name: undefined,
        cacheGroups: {}
      }
    },
    splitChunks: {
      layouts: false,
      pages: true,
      commons: true
    },
    babel: {
      babelrc: false,
      cacheDirectory: undefined
    },
    transpile: [], // Name of NPM packages to be transpiled
    postcss: {
      preset: {
        // https://cssdb.org/#staging-process
        stage: 2
      }
    },
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
      removeOptionalTags: false,
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
  vue: {
    config: {
      silent: undefined, // = !dev
      performance: undefined // = dev
    }
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
    resourceHints: true,
    ssr: undefined,
    http2: {
      push: false,
      shouldPush: null
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
    }
  },
  // User-defined changes
  watch: [],
  watchers: {
    webpack: {},
    chokidar: {
      ignoreInitial: true
    }
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
