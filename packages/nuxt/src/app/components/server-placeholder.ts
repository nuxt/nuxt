import { createElementBlock, defineComponent } from 'vue'

export default defineComponent({
  name: 'ServerPlaceholder',
  render () {
    return createElementBlock('div')
  }
})
