import type { RouterOptions } from 'nuxt/schema'
import { defineComponent, h } from 'vue'

export default <RouterOptions> {
  routes (_routes) {
    return [
      {
        name: 'catchall',
        path: '/:catchAll(.*)*',
        component: defineComponent({
          name: 'catchall',
          setup: () => () => h('div', 'catchall'),
        }),
      },
    ]
  },
}
