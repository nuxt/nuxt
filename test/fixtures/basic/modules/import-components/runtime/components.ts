import { defineComponent, h } from 'vue'

export default defineComponent({
  name: 'DComp',
  props: { message: String },
  render: (props: any) => h('h1', props.message),
})

export const NComp = defineComponent({
  name: 'NComp',
  props: { message: String },
  render: (props: any) => h('h1', props.message),
})
