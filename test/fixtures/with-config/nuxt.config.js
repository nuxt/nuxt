import path from 'path'
import compression from 'compression'

export default {
  srcDir: __dirname,
  server: {
    port: 8000,
    host: '0.0.0.0'
  },
  router: {
    base: '/test/',
    middleware: 'noop',
    extendRoutes(routes) {
      return [
        ...routes,
        {
          name: 'about-bis',
          path: '/about-bis',
          component: '~/pages/about.vue'
        },
        {
          path: '/redirect/about-bis',
          redirect: '/about-bis'
        },
        {
          path: '/not-existed'
        }
      ]
    }
  },
  modulesDir: [path.join(__dirname, '..', '..', '..', 'node_modules')],
  transition: 'test',
  layoutTransition: 'test',
  loadingIndicator: 'circle',
  extensions: 'ts',
  plugins: [
    '~/plugins/test',
    { src: '~/plugins/only-client.js', ssr: false }
  ],
  loading: '~/components/loading',
  env: {
    bool: true,
    num: 23,
    string: 'Nuxt.js',
    object: {
      bool: false,
      string: 'ok',
      num2: 8.23,
      obj: {
        again: true
      }
    }
  },
  build: {
    publicPath: '/orion/',
    cssSourceMap: true,
    parallel: true,
    analyze: {
      analyzerMode: 'disabled',
      generateStatsFile: true,
      logLevel: 'error'
    },
    styleResources: {
      scss: '~/assets/pre-process.scss'
    },
    babel: {
      presets({ isServer }) {
        return null // Coverage: Return null, so defaults will be used.
      }
    },
    transpile: 'vue-test',
    extend(config, options) {
      return Object.assign({}, config, {
        devtool: 'nosources-source-map'
      })
    }
  },
  css: [{ src: '~/assets/app.css' }],
  render: {
    csp: true,
    http2: {
      push: true,
      shouldPush: (file, type) => type === 'script'
    },
    bundleRenderer: {
      shouldPreload: (file, type) => {
        return ['script', 'style', 'font'].includes(type)
      }
    },
    compressor: function damn(...args) { return compression({ threshold: 9 })(...args) },
    static: {
      maxAge: '1y'
    }
  }
}
