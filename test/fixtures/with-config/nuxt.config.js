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
  transition: 'test',
  layoutTransition: 'test',
  offline: true,
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
    // extractCSS: true,
    publicPath: '/orion/',
    analyze: {
      analyzerMode: 'disabled',
      generateStatsFile: true
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
      push: true
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
