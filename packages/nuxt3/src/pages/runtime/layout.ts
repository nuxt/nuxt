import { defineComponent, h, Ref } from 'vue'
// @ts-ignore
import layouts from '#build/layouts'

export default defineComponent({
  props: {
    name: {
      type: [String, Boolean, Object] as unknown as () => string | false | Ref<string | false>,
      default: 'default'
    }
  },
  setup (props, context) {
    return () => {
      const layout = (props.name && typeof props.name === 'object' ? props.name.value : props.name) ?? 'default'
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
