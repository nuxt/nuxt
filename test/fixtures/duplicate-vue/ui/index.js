import { defineComponent, h, renderSlot } from '@vue/runtime-core'

export default defineComponent({
  name: 'SlotWrapper',
  render () {
    return h('div', [renderSlot(this.$slots, 'default')])
  },
})
