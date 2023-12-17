import type { defineAsyncComponent } from 'vue'
import { createVNode, defineComponent, onErrorCaptured } from 'vue'

import { createError } from '../composables/error'

export default defineComponent({
  props: {
    context: {
      type: Object as () => { name: string, props?: Record<string, any> },
      required: true
    },
    components: {
      type: Object as () => Record<string, ReturnType<typeof defineAsyncComponent>>,
      required: true
    }
  },
  setup (props) {
    const component = props.components[props.context.name] as ReturnType<typeof defineAsyncComponent>

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
