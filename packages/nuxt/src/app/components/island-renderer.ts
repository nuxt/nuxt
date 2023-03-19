import { createBlock, defineComponent, h, Teleport } from 'vue'

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
  async setup (props) {
    // TODO: https://github.com/vuejs/core/issues/6207
    const component = islandComponents[props.context.name]

    if (!component) {
      throw createError({
        statusCode: 404,
        statusMessage: `Island component not found: ${JSON.stringify(component)}`
      })
    }

    if (typeof component === 'object') {
      await component.__asyncLoader?.()
    }

    return () => [
      createBlock(Teleport as any, { to: 'nuxt-island' }, [h(component || 'span', props.context.props)])
    ]
  }
})
