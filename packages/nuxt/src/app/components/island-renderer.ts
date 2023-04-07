import type { defineAsyncComponent } from 'vue'
import { createVNode, defineComponent } from 'vue'

// @ts-ignore
import * as islandComponents from '#build/components.islands.mjs'
import { createError } from '#app/composables/error'

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
        statusMessage: `Island component not found: ${JSON.stringify(component)}`
      })
    }
    return () => createVNode(component || 'span', props.context.props)
  }
})
