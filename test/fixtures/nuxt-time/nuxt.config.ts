import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  app: {
    head: {
      title: 'NuxtTime',
      meta: [{ name: 'description', content: 'NuxtTime test fixture' }],
    },
  },
})
