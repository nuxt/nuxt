export default {
  loading: true,
  modules: [
    '~~/modules/basic',
    '~/modules/hooks',
    '~/modules/layout',
    {
      src: '~/modules/middleware',
      options: {
        foo: 'bar'
      }
    },
    ['./modules/template', { baz: 'ping' }]
  ],
  serverMiddleware: [
    './modules/middleware/midd2',
    '~/modules/middleware/midd3'
  ],
  hooks (hook) {
    hook('ready', (nuxt) => {
      nuxt.__ready_called__ = true
    })
    hook('build:done', (builder) => {
      builder.__build_done__ = true
    })
    // Add hook for renderer
    hook('render:before', (renderer) => {
      renderer.useMiddleware({
        path: '/use-middleware',
        handler: '~/modules/middleware/use-middleware'
      })
    })
  }
}
