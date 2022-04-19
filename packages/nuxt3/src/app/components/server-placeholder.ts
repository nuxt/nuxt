import { defineComponent, createElementBlock } from 'vue'

export default defineComponent({
  name: 'ServerPlaceholder',
  render () {
    return createElementBlock('div')
  }
})
