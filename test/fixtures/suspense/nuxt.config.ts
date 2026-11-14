import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  // default title/description so unhead's client-side dev validation (#35468)
  // has no missing-title/description warnings on these title-less test pages
  app: {
    head: {
      title: 'Suspense',
      meta: [{ name: 'description', content: 'Suspense test fixture' }],
    },
  },
  experimental: {
    // the element placeholder (the default before compatibility version 5) for client-only components
    clientNodePlaceholder: false,
  },
})
