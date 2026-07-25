import { withMatrix } from '../../matrix'

export default withMatrix({
  devtools: { enabled: false },
  routeRules: {
    '/admin/**': { ssr: false },
    '/admin/ssr': { ssr: true },
  },
  experimental: {
    inlineRouteRules: true,
  },
})
