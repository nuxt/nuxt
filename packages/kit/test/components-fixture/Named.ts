import { defineComponent } from 'vue'

export const NamedExport = defineComponent({
  setup () {
    return () => 'hello'
  },
})

export default defineComponent({
  setup () {
    return () => 'default'
  },
})
