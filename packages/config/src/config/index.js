import path from 'path'
import fs from 'fs'
import capitalize from 'lodash/capitalize'
import env from 'std-env'

import render from './render'
import build from './build'
import router from './router'
import messages from './messages'
import server from './server'

const nuxtDir = fs.existsSync(path.resolve(__dirname, '..', '..', 'package.js'))
  ? path.resolve(__dirname, '..', '..') // src
  : path.resolve(__dirname, '..') // dist

export default {
  // Information about running environment
  dev: Boolean(env.dev),
  test: Boolean(env.test),
  debug: undefined, // = dev

  // Mode
  mode: 'universal',

  // Global name
  globalName: `nuxt`,
  globals: {
    id: globalName => `__${globalName}`,
    nuxt: globalName => `$${globalName}`,
    context: globalName => `__${globalName.toUpperCase()}__`,
    pluginPrefix: globalName => globalName,
    readyCallback: globalName => `on${capitalize(globalName)}Ready`,
    loadedCallback: globalName => `_on${capitalize(globalName)}Loaded`
  },

  render,
  build,
  router,
  messages,

  // Server options
  server: server(process.env),

  // Dirs
  srcDir: undefined,
  buildDir: '.nuxt',
  nuxtDir,
  modulesDir: [
    'node_modules'
  ],

  // Ignore
  ignorePrefix: '-',
  ignore: [
    '**/*.test.*',
    '**/*.spec.*'
  ],

  extensions: [],

  generate: {
    dir: 'dist',
    routes: [],
    concurrency: 500,
    interval: 0,
    subFolders: true,
    fallback: '200.html'
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
    throttle: 200,
    duration: 5000,
    continuous: false,
    rtl: false,
    css: true
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

  // User-defined changes
  watch: [],
  watchers: {
    webpack: {},
    chokidar: {
      ignoreInitial: true
    }
  },
  editor: undefined,
  hooks: null
}
