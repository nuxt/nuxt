import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  devtools: { enabled: false },
  routeRules: {
    '/spa': { ssr: false },
    '/api/cached-error': { swr: 60, headers: { 'cache-control': 'public, max-age=60' } },
    '/error/not-found': { headers: { 'cache-control': 'public, max-age=60' } },
    '/api/returned-error': { headers: { 'cache-control': 'public, max-age=60' } },
  },
  compatibilityDate: 'latest',
})
