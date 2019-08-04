import capitalize from 'lodash/capitalize'
import env from 'std-env'

export default () => ({
  // Env
  dev: Boolean(env.dev),
  test: Boolean(env.test),
  debug: undefined, // = dev
  env: {},

  // Mode
  mode: 'universal',
  modern: undefined,

  // Globals
  globalName: `nuxt`,
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
    fallback: '200.html'
  },

  // Watch
  watch: [],
  watchers: {
    rewatchOnRawEvents: undefined,
    webpack: {},
    chokidar: {
      ignoreInitial: true
    }
  },

  // Editor
  editor: undefined,

  // Hooks
  hooks: null
})
