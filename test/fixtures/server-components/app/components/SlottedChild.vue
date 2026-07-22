<script lang="ts">
import { Comment, Fragment, cloneVNode, defineComponent, mergeProps } from 'vue'
import type { VNode } from 'vue'

function flatten (children: VNode[]): VNode[] {
  return children.flatMap((c) => {
    if (c.type === Fragment) { return flatten(c.children as VNode[]) }
    return [c]
  })
}

export default defineComponent({
  name: 'PrimitiveSlot',
  inheritAttrs: false,
  setup (_, { attrs, slots }) {
    return () => {
      if (!slots.default) { return null }
      const children = flatten(slots.default())
      const idx = children.findIndex(c => c.type !== Comment)
      if (idx === -1) { return children }
      const first = children[idx]!
      const merged = first.props ? mergeProps(attrs, first.props) : attrs
      const cloned = cloneVNode({ ...first, props: {} }, merged)
      if (children.length === 1) { return cloned }
      children[idx] = cloned
      return children
    }
  },
})
</script>
