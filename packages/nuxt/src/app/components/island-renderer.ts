import type { defineAsyncComponent } from 'vue'
import { createVNode, defineComponent, onErrorCaptured, provide } from 'vue'
import { createHead, headSymbol } from '@unhead/vue/server'

import { useNuxtApp } from '../nuxt'
import { createError } from '../composables/error'

// @ts-expect-error virtual file
import { islandComponents } from '#build/components.islands.mjs'
// @ts-expect-error virtual file
import unheadOptions from '#build/unhead-options.mjs'

export default defineComponent({
  name: 'IslandRenderer',
  props: {
    context: {
      type: Object as () => { name: string, props?: Record<string, any> },
      required: true,
    },
  },
  setup (props) {
    // Use an isolated head for the island so it doesn't include head tags from plugins
    // and, more importantly, so concurrent route renders don't clobber each other's head
    // entries via Vue's module-global `currentInstance` (see #32100 regression).
    const head = createHead(unheadOptions)
    provide(headSymbol, head)
    const ssrContext = useNuxtApp().ssrContext
    if (ssrContext) {
      ssrContext.head = head
    }

    const component = islandComponents[props.context.name] as ReturnType<typeof defineAsyncComponent>

    if (!component) {
      throw createError({
        status: 404,
        statusText: `Island component not found: ${props.context.name}`,
      })
    }

    onErrorCaptured((e) => {
      console.log(e)
    })

    return () => createVNode(component || 'span', { ...props.context.props, 'data-island-uid': '' })
  },
})
