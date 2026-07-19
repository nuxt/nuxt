import { defineComponent } from 'vue'
import type { DefineSetupFnComponent, SlotsType, VNode } from 'vue'

type DevOnlySlots = SlotsType<{
  default?: () => VNode[]
  /**
   * If you ever require to have a replacement during production.
   */
  fallback?: () => VNode[]
}>

const DevOnly = defineComponent({
  name: 'DevOnly',
  inheritAttrs: false,
  ...(import.meta.dev && {
    slots: Object as DevOnlySlots,
  }),
  setup (_, props) {
    if (import.meta.dev) {
      return () => props.slots.default?.()
    }
    return () => props.slots.fallback?.()
  },
}) as unknown as DefineSetupFnComponent<{}, {}, DevOnlySlots>

export default DevOnly
