import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  app: {
    head: {
      title: 'Preview',
      meta: [{ name: 'description', content: 'Preview mode test fixture' }],
    },
  },
  routeRules: {
    '/preview-only-prerendered': { prerender: true },
    '/preview-only-delayed': { prerender: true },
  },
})
