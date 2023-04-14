import { randomUUID } from 'uncrypto'
import type { defineAsyncComponent } from 'vue'
import { createVNode, defineComponent } from 'vue'

// @ts-expect-error virtual file
import * as islandComponents from '#build/components.islands.mjs'
import { createError } from '#app/composables/error'

export default defineComponent({
  props: {
    context: {
      type: Object as () => { name: string, props?: Record<string, any>, slotsName?: string[], uid?: string },
      required: true
    }
  },
  setup (props) {
    const uid = props.context.uid ?? randomUUID()
    const component = islandComponents[props.context.name] as ReturnType<typeof defineAsyncComponent>

    if (!component) {
      throw createError({
        statusCode: 404,
        statusMessage: `Island component not found: ${JSON.stringify(component)}`
      })
    }

    return () => createVNode(component || 'span', { ...props.context.props, 'nuxt-ssr-component-uid': uid })
  }
})
