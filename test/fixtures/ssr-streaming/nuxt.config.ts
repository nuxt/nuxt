import { withMatrix } from '../../matrix'

export default withMatrix({
  css: ['~/assets/main.css'],
  routeRules: {
    '/buffered': { streaming: false },
  },
  experimental: {
    ssrStreaming: true,
  },
})
