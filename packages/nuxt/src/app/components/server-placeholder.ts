import { createCommentVNode, createElementBlock, defineComponent } from 'vue'
import type { DefineSetupFnComponent } from 'vue'

import { clientNodePlaceholder } from '#build/nuxt.config.mjs'

const ServerPlaceholder = defineComponent({
  name: 'ServerPlaceholder',
  render () {
    return clientNodePlaceholder ? createCommentVNode('placeholder') : createElementBlock('div')
  },
}) as unknown as DefineSetupFnComponent<{}>

export default ServerPlaceholder
