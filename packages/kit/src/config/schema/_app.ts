import { resolve, join } from 'path'
import { existsSync, readdirSync } from 'fs'
import defu from 'defu'
import { isRelative, joinURL, hasProtocol } from 'ufo'

export default {
  /**
   * Vue.js configuration
   */
  vue: {
    config: {
      silent: { $resolve: (val, get) => val ?? get('dev') },
      performance: { $resolve: (val, get) => val ?? get('dev') }
    }
  },

  app: {
    $resolve: (val, get) => {
      const useCDN = hasProtocol(get('build.publicPath'), true) && !get('dev')
      const isRelativePublicPath = isRelative(get('build.publicPath'))
      return defu(val, {
        basePath: get('router.base'),
        assetsPath: isRelativePublicPath ? get('build.publicPath') : useCDN ? '/' : joinURL(get('router.base'), get('build.publicPath')),
        cdnURL: useCDN ? get('build.publicPath') : null
      })
    }
  },

  /**
   * Uses {srcDir}/app.html if exists by default otherwise nuxt default
   */
  appTemplatePath: {
    $resolve: (val, get) => {
      if (val) {
        return resolve(get('srcDir'), val)
      }
      if (existsSync(join(get('srcDir'), 'app.html'))) {
        return join(get('srcDir'), 'app.html')
      }
      return resolve(get('buildDir'), 'views/app.template.html')
    }
  },

  store: {
    $resolve: (val, get) => val !== false &&
      existsSync(join(get('srcDir'), get('dir.store'))) &&
      readdirSync(join(get('srcDir'), get('dir.store')))
        .find(filename => filename !== 'README.md' && filename[0] !== '.')
  },

  /**
   * debug errorss
   */
  debug: {
    $resolve: (val, get) => val ?? get('dev')
  },

  vueMeta: null,

  head: {
    meta: [],
    link: [],
    style: [],
    script: []
  },

  fetch: {
    server: true,
    client: true
  },

  plugins: [],

  extendPlugins: null,

  css: [],

  layouts: {},

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

  loadingIndicator: {
    $resolve: (val, get) => {
      if (typeof val === 'string') {
        val = { name: val }
      }
      return {
        name: 'default',
        color: get('loading.color') || '#D3D3D3',
        color2: '#F5F5F5',
        background: (get('manifest') && get('manifest.theme_color')) || 'white',
        dev: get('dev'),
        loading: get('messages.loading'),
        ...val
      }
    }
  },

  pageTransition: {
    $resolve: val => typeof val === 'string' ? { name: val } : val,
    name: 'page',
    mode: 'out-in',
    appear: { $resolve: (val, get) => (get('render.ssr') === false) ? true : Boolean(val) },
    appearClass: 'appear',
    appearActiveClass: 'appear-active',
    appearToClass: 'appear-to'
  },

  layoutTransition: {
    $resolve: val => typeof val === 'string' ? { name: val } : val,
    name: 'layout',
    mode: 'out-in'
  },

  features: {
    store: true,
    layouts: true,
    meta: true,
    middleware: true,
    transitions: true,
    deprecations: true,
    validate: true,
    asyncData: true,
    fetch: true,
    clientOnline: true,
    clientPrefetch: true,
    componentAliases: true,
    componentClientOnly: true
  }
}
