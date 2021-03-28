import { join, resolve } from 'path'
import env from 'std-env'
import createRequire from 'create-require'
import { pascalCase } from 'scule'
import jiti from 'jiti'

export default {
  rootDir: {
    $resolve: val => typeof val === 'string' ? resolve(val) : process.cwd()
  },

  srcDir: {
    $resolve: (val, get) => resolve(get('rootDir'), val || '.')
  },

  buildDir: {
    $resolve: (val, get) => resolve(get('rootDir'), val || '.nuxt')
  },

  dev: Boolean(env.dev),
  test: Boolean(env.test),
  debug: undefined,
  env: {
    $resolve: (val) => {
      val = { ...val }
      for (const key in process.env) {
        if (key.startsWith('NUXT_ENV_')) {
          val[key] = process.env[key]
        }
      }
      return val
    }
  },

  createRequire: {
    $resolve: (val: any) => {
      val = process.env.NUXT_CREATE_REQUIRE || val ||
        (typeof jest !== 'undefined' ? 'native' : 'jiti')
      if (val === 'jiti') {
        return p => jiti(typeof p === 'string' ? p : p.filename)
      }
      if (val === 'native') {
        return p => createRequire(typeof p === 'string' ? p : p.filename)
      }
      return val
    }
  },

  target: {
    $resolve: val => ['server', 'static'].includes(val) ? val : 'server'
  },

  ssr: true,

  mode: {
    $resolve: (val, get) => val || (get('ssr') ? 'spa' : 'universal'),
    $schema: { deprecated: '`mode` option is deprecated' }
  },

  modern: undefined,

  modules: [],
  buildModules: [],
  _modules: [],

  globalName: {
    $resolve: val => (typeof val === 'string' && /^[a-zA-Z]+$/.test(val)) ? val.toLocaleLowerCase() : 'nuxt'
  },

  globals: {
    id: globalName => `__${globalName}`,
    nuxt: globalName => `$${globalName}`,
    context: globalName => `__${globalName.toUpperCase()}__`,
    pluginPrefix: globalName => globalName,
    readyCallback: globalName => `on${pascalCase(globalName)}Ready`,
    loadedCallback: globalName => `_on${pascalCase(globalName)}Loaded`
  },

  serverMiddleware: {
    $resolve: (val: any) => {
      if (!val) {
        return []
      }
      if (!Array.isArray(val)) {
        return Object.entries(val).map(([path, handler]) => ({ path, handler }))
      }
      return val
    }
  },

  _nuxtConfigFile: {
    $resolve: (val, get) => resolve(get('rootDir'), val || 'nuxt.config.js')
  },

  _nuxtConfigFiles: {
    $resolve: (val, get) => [].concat(get('_nuxtConfigFile'), val).filter(Boolean)
  },

  modulesDir: {
    $default: ['node_modules'],
    $resolve: (val, get) => val.map(dir => resolve(get('rootDir'), dir))
  },

  dir: {
    assets: 'assets',
    app: 'app',
    layouts: 'layouts',
    middleware: 'middleware',
    pages: 'pages',
    static: 'static',
    store: 'store'
  },

  extensions: {
    $resolve: val => ['js', 'mjs', 'ts', 'tsx', 'vue'].concat(val).filter(Boolean)
  },

  styleExtensions: ['css', 'pcss', 'postcss', 'styl', 'stylus', 'scss', 'sass', 'less'],

  alias: {
    $resolve: (val, get) => ({
      '~~': get('rootDir'),
      '@@': get('rootDir'),
      '~': get('srcDir'),
      '@': get('srcDir'),
      [get('dir.assets')]: join(get('srcDir'), get('dir.assets')),
      [get('dir.static')]: join(get('srcDir', get('dir.static'))),
      ...val
    })
  },

  ignoreOptions: undefined,
  ignorePrefix: '-',
  ignore: {
    $resolve: (val, get) => [
      '**/*.test.*',
      '**/*.spec.*',
      get('ignorePrefix') && `**/${get('ignorePrefix')}*.*`
    ].concat(val).filter(Boolean)
  },

  watch: {
    $resolve: (_val, get) => [].concat(get._nuxtConfigFiles).filter(Boolean)
  },

  watchers: {
    rewatchOnRawEvents: undefined,
    webpack: {
      aggregateTimeout: 1000
    },
    chokidar: {
      ignoreInitial: true
    }
  },

  editor: undefined,

  hooks: null,

  privateRuntimeConfig: {},
  publicRuntimeConfig: {
    app: {
      $resolve: (val, get) => ({ ...get('app'), ...(val || {}) })
    }
  }
}
