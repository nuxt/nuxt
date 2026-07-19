import type { DefineSetupFnComponent, defineAsyncComponent } from 'vue'
import { computed, createVNode, defineComponent, onErrorCaptured, provide } from 'vue'
import { viewDepthKey } from 'vue-router'

import { createError } from '../composables/error'
import { useRoute } from '../composables/router'
import { renderDiagnostics } from '../diagnostics/render.ts'

import { islandComponents, pageIslandRoutes } from '#build/components.islands.mjs'

interface IslandRendererProps {
  context: { name: string, props?: Record<string, any> }
}

const PAGE_ISLAND_PREFIX = 'page_'

const IslandRenderer = defineComponent({
  name: 'IslandRenderer',
  props: {
    context: {
      type: Object as () => { name: string, props?: Record<string, any> },
      required: true,
    },
  },
  setup (props) {
    const name = props.context.name
    const component = Object.hasOwn(islandComponents, name)
      ? islandComponents[name] as ReturnType<typeof defineAsyncComponent>
      : undefined

    if (!component) {
      throw createError({
        status: 404,
        statusText: `Island component not found: ${props.context.name}`,
      })
    }

    // A `.server.vue` page rendered as an island mounts the SFC directly here,
    // bypassing the `<RouterView>` chain that would normally set view depth.
    if (props.context.name.startsWith(PAGE_ISLAND_PREFIX)) {
      const expectedIslandKey = pageIslandRoutes[props.context.name]
      const route = useRoute()
      provide(viewDepthKey, computed(() => {
        const depth = route.matched.findIndex(m => (m.components?.default as any)?.__nuxt_island === expectedIslandKey)
        return depth === -1 ? 0 : depth + 1
      }))
    }

    onErrorCaptured((e) => {
      renderDiagnostics.NUXT_E4015({ name, cause: e })
    })

    return () => createVNode(component || 'span', { ...props.context.props, 'data-island-uid': '' })
  },
}) as unknown as DefineSetupFnComponent<IslandRendererProps>

export default IslandRenderer
