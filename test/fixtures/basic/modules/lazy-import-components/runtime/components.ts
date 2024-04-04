import { defineComponent, h } from 'vue'

export const NComp = defineComponent({
  name: 'NComp',
  props: { message: String },
  render: (props: any) => h('h1', props.message)
})
