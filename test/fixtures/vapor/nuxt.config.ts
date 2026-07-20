import { withMatrix } from '../../matrix'

export default withMatrix({
  runtimeConfig: {
    public: {
      testValue: 'runtime-config-ok',
    },
  },
  app: {
    head: {
      title: 'Vapor',
      meta: [{ name: 'description', content: 'Vapor interop test fixture' }],
    },
  },
})
