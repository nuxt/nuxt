import { withMatrix } from '../../matrix'

export default withMatrix({
  devtools: { enabled: false },
  spaLoadingTemplate: true,
  routeRules: {
    '/spa': { ssr: false },
    '/ssr': { ssr: true },
  },
  experimental: {
    spaLoadingTemplateLocation: 'within',
  },
})
