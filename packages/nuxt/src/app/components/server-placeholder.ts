import { createCommentVNode, defineComponent } from 'vue'

export default defineComponent({
  name: 'ServerPlaceholder',
  render () {
    return createCommentVNode('placeholder')
  },
})
