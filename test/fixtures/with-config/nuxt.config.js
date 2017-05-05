module.exports = {
  router: {
    base: '/test/',
    extendRoutes (routes) {
      routes.push({
        name: 'about-bis',
        path: '/about-bis',
        component: '~pages/about.vue'
      })
    }
  },
  cache: true,
  offline: true,
  plugins: [
    '~plugins/test.js',
    { src: '~plugins/offline.js', ssr: false },
    { src: '~plugins/only-client.js', ssr: false }
  ],
  loading: '~components/loading',
  env: {
    bool: true,
    num: 23,
    string: 'Nuxt.js'
  },
  build: {
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
    {src: '~/assets/app.css'}
  ]
}
