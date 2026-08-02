import { fileURLToPath } from 'node:url'

import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  app: {
    head: {
      title: 'Route scroll',
      meta: [{ name: 'description', content: 'Route scroll behavior test fixture' }],
    },
  },
  hooks: {
    'pages:resolved' (pages) {
      pages.push({
        path: '/big-page-1',
        file: fileURLToPath(new URL('./extra/big-page.vue', import.meta.url)),
        meta: {
          layout: false,
        },
      },
      {
        path: '/big-page-2',
        file: fileURLToPath(new URL('./extra/big-page.vue', import.meta.url)),
        meta: {
          layout: false,
        },
      })
    },
  },
})
