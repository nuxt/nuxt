import capitalize from 'lodash/capitalize'
import env from 'std-env'
import { TARGETS, MODES } from '@nuxt/utils'

export default () => ({
  // Env
  dev: Boolean(env.dev),
  test: Boolean(env.test),
  debug: undefined, // = dev
  env: {},

  // Target
  target: TARGETS.server,

  // Mode
  mode: MODES.universal,
  modern: undefined,

  globalName: undefined,
  globals: {
    id: globalName => `__${globalName}`,
    nuxt: globalName => `$${globalName}`,
    context: globalName => `__${globalName.toUpperCase()}__`,
    pluginPrefix: globalName => globalName,
    readyCallback: globalName => `on${capitalize(globalName)}Ready`,
    loadedCallback: globalName => `_on${capitalize(globalName)}Loaded`
  },

  // Server
  serverMiddleware: [],

  // Dirs and extensions
  _nuxtConfigFile: undefined,
  srcDir: undefined,
  buildDir: '.nuxt',
  modulesDir: [
    'node_modules'
  ],
  dir: {
    assets: 'assets',
    app: 'app',
    layouts: 'layouts',
    middleware: 'middleware',
    pages: 'pages',
    static: 'static',
    store: 'store'
  },
  extensions: [],
  styleExtensions: ['css', 'pcss', 'postcss', 'styl', 'stylus', 'scss', 'sass', 'less'],
  alias: {},

  // Ignores
  ignoreOptions: undefined,
  ignorePrefix: '-',
  ignore: [
    '**/*.test.*',
    '**/*.spec.*'
  ],

  // Generate
  generate: {
    dir: 'dist',
    routes: [],
    exclude: [],
    concurrency: 500,
    interval: 0,
    subFolders: true,
    fallback: '200.html',
    static: true,
    crawler: true
  },

  // Watch
  watch: [],
  watchers: {
    rewatchOnRawEvents: undefined,
    webpack: {
      aggregateTimeout: 1000
    },
    chokidar: {
      ignoreInitial: true
    }
  },

  // Editor
  editor: undefined,

  // Hooks
  hooks: null
})
