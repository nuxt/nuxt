import { defineComponent } from 'vue'

export default defineComponent({
  name: 'DevOnly',
  inheritAttrs: false,
  setup (_, props) {
    if (import.meta.dev) {
      return () => props.slots.default?.()
    }
    return () => props.slots.fallback?.()
  },
})
