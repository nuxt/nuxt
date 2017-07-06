module.exports = {
  srcDir: __dirname,
  router: {
    base: '/test/',
    middleware: 'noop',
    extendRoutes (routes) {
      routes.push({
        name: 'about-bis',
        path: '/about-bis',
        component: '~/pages/about.vue'
      })
    }
  },
  transition: 'test',
  offline: true,
  plugins: [
    '~/plugins/test.js', // Use ~ for deprication warning coverage
    { src: '~/plugins/only-client.js', ssr: false }
  ],
  loading: '~/components/loading',
  env: {
    bool: true,
    num: 23,
    string: 'Nuxt.js'
  },
  build: {
    extractCSS: true,
    publicPath: '/orion/',
    analyze: {
      analyzerMode: 'disabled',
      generateStatsFile: true
    },
    extend (config, options) {
      config.devtool = 'nosources-source-map'
    }
  },
  css: [
    { src: '~/assets/app.css' }
  ],
  render: {
    http2: {
      push: true
    },
    static: {
      maxAge: '1y'
    }
  }
}
