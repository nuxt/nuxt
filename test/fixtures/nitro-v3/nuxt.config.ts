import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  devtools: { enabled: false },
  routeRules: {
    '/spa': { ssr: false },
  },
  compatibilityDate: 'latest',
})
