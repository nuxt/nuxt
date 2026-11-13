import { defineComponent, renderSlot } from 'vue'
import type { PropType, Slots, VNode } from 'vue'
import { ownSlots } from './shared'

// `slotScopeIds` is internal to Vue's VNode type.
type SlottedVNode = VNode & { slotScopeIds?: string[] }

/**
 * Renders a page slot at an island's `i:s` marker. `renderSlot` needs a rendering instance,
 * which the DOM walk runs without, so the walk creates this component instead.
 */
export default /* @__PURE__ */ defineComponent({
  name: 'NuxtIslandSlotOutlet',
  props: {
    islandSlots: {
      type: Object as PropType<Slots>,
      required: false,
      default: undefined,
    },
    name: {
      type: String,
      required: true,
    },
    slotProps: {
      type: Object as PropType<Record<string, any> | null>,
      required: false,
      default: null,
    },
    fallback: {
      type: Array as PropType<VNode[]>,
      required: false,
      default: undefined,
    },
    slotScopeId: {
      type: String,
      required: false,
      default: undefined,
    },
  },
  setup (props) {
    return () => {
      const fallback = props.fallback
      // `noSlotted`: the slotted scope id is the island's, carried by the marker, not this component's.
      const vnode = renderSlot(ownSlots(props.islandSlots, props.name), props.name, props.slotProps ?? {}, fallback && (() => fallback), true)
      if (props.slotScopeId) { (vnode as SlottedVNode).slotScopeIds = [props.slotScopeId] }
      return vnode
    }
  },
})
