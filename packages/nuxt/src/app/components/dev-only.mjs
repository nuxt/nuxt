import { defineComponent } from 'vue'

export default defineComponent({
  name: 'DevOnly',
  setup (_, props) {
    if (process.dev) {
      return () => props.slots.default?.()
    }
    return () => null
  }
})
