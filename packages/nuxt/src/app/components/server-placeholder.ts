import { createCommentVNode, createElementBlock, defineComponent } from 'vue'
import { clientNodePlaceholder } from '#build/nuxt.config.mjs'

export default defineComponent({
  name: 'ServerPlaceholder',
  render () {
    return clientNodePlaceholder ? createCommentVNode('placeholder') : createElementBlock('div')
  },
})
