import { defineComponent, isRef, Ref, Transition } from 'vue'
import { useRoute } from 'vue-router'
import { wrapIf } from './utils'
// @ts-ignore
import layouts from '#build/layouts'

const defaultLayoutTransition = { name: 'layout', mode: 'out-in' }

export default defineComponent({
  props: {
    name: {
      type: [String, Boolean, Object] as unknown as () => string | false | Ref<string | false>,
      default: null
    }
  },
  setup (props, context) {
    const route = useRoute()

    return () => {
      const layout = (isRef(props.name) ? props.name.value : props.name) ?? route.meta.layout as string ?? 'default'

      const hasLayout = layout && layout in layouts
      if (process.dev && layout && !hasLayout && layout !== 'default') {
        console.warn(`Invalid layout \`${layout}\` selected.`)
      }

      // We avoid rendering layout transition if there is no layout to render
      return wrapIf(Transition, hasLayout && (route.meta.layoutTransition ?? defaultLayoutTransition),
        wrapIf(layouts[layout], hasLayout, context.slots)
      ).default()
    }
  }
})
