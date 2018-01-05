const path = require('path')

module.exports = {
  srcDir: __dirname,
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
        }
      ]
    }
  },
  modulesDir: [
    path.join(__dirname, '..', '..', '..', 'node_modules')
  ],
  transition: 'test',
  layoutTransition: 'test',
  loadingIndicator: 'circle',
  offline: true,
  extensions: 'ts',
  plugins: [
    '~/plugins/test.js',
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
    stats: false,
    publicPath: '/orion/',
    analyze: {
      analyzerMode: 'disabled',
      generateStatsFile: true
    },
    styleResources: {
      patterns: [
        '~/assets/pre-process.scss'
      ]
    },
    babel: {
      presets({ isServer }) {
        return null // Coverage: Return null, so defaults will be used.
      }
    },
    extend(config, options) {
      return Object.assign({}, config, {
        devtool: 'nosources-source-map'
      })
    }
  },
  css: [
    { src: '~/assets/app.css' }
  ],
  render: {
    http2: {
      push: true,
      shouldPush: (file, type) => type === 'script'
    },
    bundleRenderer: {
      shouldPreload: (file, type) => {
        return ['script', 'style', 'font'].includes(type)
      }
    },
    static: {
      maxAge: '1y'
    }
  }
}
