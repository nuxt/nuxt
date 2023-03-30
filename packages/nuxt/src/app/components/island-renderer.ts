import { randomUUID } from 'node:crypto'
import type { defineAsyncComponent } from 'vue'
import { renderSlot, createBlock, defineComponent, createVNode, h } from 'vue'

// @ts-ignore
import { ssrRenderSlot } from 'vue/server-renderer'
import * as islandComponents from '#build/components.islands.mjs'
import { createError } from '#app/composables/error'
const SLOT_RENDER_RE = /ssrRenderSlot\(_ctx.\$slots, "([a-zA-Z]*)"/g

export default defineComponent({
  props: {
    context: {
      type: Object as () => { name: string, props?: Record<string, any> },
      required: true
    }
  },
  async setup (props, ctx) {
    const uid = randomUUID()
    const component = islandComponents[props.context.name] as ReturnType<typeof defineAsyncComponent>
    const slots: Record<string, Function> = {}
    if (typeof component === 'object') {
      await (component.__asyncLoader as Function)?.()
      const matched = [...(component.__asyncResolved.ssrRender as Function).toString().matchAll(SLOT_RENDER_RE)]

      for (const [_full, slotName] of matched) {
        slots[slotName] = () => {
          return createVNode('div', { 'v-ssr-slot-name': slotName },
            renderSlot(ctx.slots, slotName)
          )
        }
      }
    }
    if (!component) {
      throw createError({
        statusCode: 404,
        statusMessage: `Island component not found: ${JSON.stringify(component)}`
      })
    }

    const toRender = component.__asyncResolved ?? component
    return () => [createVNode(toRender || 'span', { ...props.context.props, 'v-ssr-component-uid': uid }, slots)]
  }
})
