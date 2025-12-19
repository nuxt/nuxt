import { withMatrix } from '../../matrix'

export default withMatrix({
  modules: ['./modules/dynamic-route-rules'],
  experimental: {
    inlineRouteRules: true,
  },
})
