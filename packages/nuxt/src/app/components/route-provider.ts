import { defineComponent, nextTick, onMounted } from 'vue'
import type { VNode } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export const RouteProvider = defineComponent({
  name: 'RouteProvider',
  props: {
    vnode: {
      type: Object as () => VNode,
      required: true,
    },
    route: {
      type: Object as () => RouteLocationNormalizedLoaded,
      required: true,
    },
  },
  setup (props, context) {
    if (import.meta.dev && import.meta.client) {
      onMounted(() => {
        if (props.vnode.transition) {
          nextTick(() => {
            if (['#comment', '#text'].includes(props.vnode?.el?.nodeName)) {
              const filename = (props.vnode?.type as any).__file
              console.warn(`[nuxt] \`${filename}\` does not have a single root node and will cause errors when navigating between routes.`)
            }
          })
        }
      })
    }

    return () => context.slots.default?.()
  },
})
