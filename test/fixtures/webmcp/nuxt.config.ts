import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  app: {
    head: {
      title: 'WebMCP',
      meta: [{ name: 'description', content: 'WebMCP test fixture' }],
    },
  },
  experimental: {
    webmcp: true,
  },
})
