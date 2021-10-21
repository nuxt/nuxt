import { defineComponent, h } from 'vue'
// @ts-ignore
import layouts from '#build/layouts'

export default defineComponent({
  props: {
    name: {
      type: [String, Boolean],
      default: 'default'
    }
  },
  setup (props, context) {
    return () => {
      const layout = props.name
      if (!layouts[layout]) {
        if (process.dev && layout && layout !== 'default') {
          console.warn(`Invalid layout \`${layout}\` selected.`)
        }
        return context.slots.default()
      }
      return h(layouts[layout], props, context.slots)
    }
  }
})
