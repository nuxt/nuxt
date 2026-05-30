import { withMatrix } from '../../matrix'

export default withMatrix({
  app: {
    cdnURL: 'https://cdn.example.com/',
    crossOrigin: 'use-credentials',
  },
  css: ['~/assets/main.css'],
  experimental: {
    ssrStreaming: true,
  },
})
