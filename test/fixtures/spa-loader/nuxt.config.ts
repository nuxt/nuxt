import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  spaLoadingTemplate: true,
  routeRules: {
    '/spa': { ssr: false },
    '/ssr': { ssr: true },
  },
  experimental: {
    spaLoadingTemplateLocation: 'within',
  },
})
