import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  app: {
    head: {
      title: 'Lazy hydration',
      meta: [{ name: 'description', content: 'Lazy hydration test fixture' }],
    },
  },
  features: {
    inlineStyles: false,
  },
})
