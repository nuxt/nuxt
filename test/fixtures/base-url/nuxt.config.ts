import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  app: {
    baseURL: '/foo/',
  },
  routeRules: {
    '/no-ssr': { ssr: false },
    '/prerendered': { prerender: true },
  },
})
