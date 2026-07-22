import { withMatrix } from '../../matrix'

export default withMatrix({
  app: {
    head: {
      title: 'Vapor',
      meta: [{ name: 'description', content: 'Vapor interop test fixture' }],
    },
  },
  vue: {
    vapor: true,
  },
  runtimeConfig: {
    public: {
      testValue: 'runtime-config-ok',
    },
  },
  experimental: {
    componentIslands: true,
  },
})
