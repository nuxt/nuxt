import { defineComponent } from 'vue'
import type { SlotsType, VNode } from 'vue'

export default defineComponent({
  name: 'DevOnly',
  inheritAttrs: false,
  ...(import.meta.dev && {
    slots: Object as SlotsType<{
      default?: () => VNode[]

      /**
       * If you ever require to have a replacement during production.
       */
      fallback?: () => VNode[]
    }>,
  }),
  setup (_, props) {
    if (import.meta.dev) {
      return () => props.slots.default?.()
    }
    return () => props.slots.fallback?.()
  },
})
