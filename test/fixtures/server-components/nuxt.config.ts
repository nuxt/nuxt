import { withMatrix } from '../../matrix'

export default withMatrix({
  experimental: {
    componentIslands: {
      selectiveClient: 'deep',
    },
    runtimeBaseURL: true,
  },
  nitro: {
    prerender: {
      routes: [
        '/prefetch/server-components',
      ],
    },
  },
})
