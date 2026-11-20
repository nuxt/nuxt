import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  routeRules: {
    '/spa/*': { ssr: false },
    '/redirect/*': { redirect: '/target' },
    '/middleware/*': { appMiddleware: 'probe' },
    '/cache/*': { swr: 60 },
    '/prerendered/*': { prerender: true },
  },
  // `redirect` rules are applied on client navigation only outside test builds
  test: false,
})
