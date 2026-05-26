import { withMatrix } from '../../matrix'

export default withMatrix({
  css: ['~/assets/main.css'],
  routeRules: {
    '/buffered': { streaming: false },
  },
  experimental: {
    ssrStreaming: true,
    // Enables the `nuxt-client` selective-client island path exercised by
    // `/islands` (the `uid;client` teleport marker).
    componentIslands: { selectiveClient: true },
  },
})
