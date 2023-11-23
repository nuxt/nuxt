import type { defineAsyncComponent } from 'vue'
import { createVNode, defineComponent, onErrorCaptured } from 'vue'

import { createError } from '../composables/error'

// @ts-expect-error virtual file
import * as islandComponents from '#build/components.islands.mjs'

export default defineComponent({
  props: {
    context: {
      type: Object as () => { name: string, props?: Record<string, any> },
      required: true
    }
  },
  setup (props) {
    const component = islandComponents[props.context.name] as ReturnType<typeof defineAsyncComponent>

    if (!component) {
      throw createError({
        statusCode: 404,
        statusMessage: `Island component not found: ${props.context.name}`
      })
    }

    onErrorCaptured((e) => {
      console.log(e)
    })

    return () => createVNode(component || 'span', { ...props.context.props, 'nuxt-ssr-component-uid': '' })
  }
})
