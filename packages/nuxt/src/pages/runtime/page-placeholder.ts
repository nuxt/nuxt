import { defineComponent } from 'vue'

export default defineComponent({
  name: 'NuxtPage',
  setup (_, props) {
    if (process.dev) {
      console.warn('Create a Vue component in the `pages/` directory to enable `<NuxtPage>`')
    }
    return () => props.slots.default?.()
  }
})
