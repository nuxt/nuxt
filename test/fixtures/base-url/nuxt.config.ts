import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  app: {
    baseURL: '/foo/',
  },
  routeRules: {
    '/no-ssr': { ssr: false },
    '/prerendered': { prerender: true },
    '/api/prerendered-fetch': { prerender: true },
    '/api/echo': { headers: { 'x-echo': '1' } },
  },
})
