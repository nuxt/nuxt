import { withMatrix } from '../../matrix'

export default withMatrix({
  // default title/description so unhead's client-side dev validation (#35468)
  // has no missing-title/description warnings on these title-less test pages
  app: {
    head: {
      title: 'Suspense Layout',
      meta: [{ name: 'description', content: 'Suspense layout test fixture' }],
    },
  },
  routeRules: {
    '/': { appLayout: 'alternate' },
  },
})
