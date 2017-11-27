module.exports = {
  loading: true,
  modules: [
    '~~/modules/basic',
    '~/modules/hooks',
    {
      src: '~/modules/middleware',
      options: {
        foo: 'bar'
      }
    },
    ['./modules/template', {baz: 'ping'}]
  ],
  serverMiddleware: [
    './modules/middleware/midd2'
  ],
  hooks(hook) {
    hook('ready', nuxt => {
      nuxt.__ready_called__ = true
    })
    hook('build:done', builder => {
      builder.__build_done__ = true
    })
  }
}
