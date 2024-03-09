import type { VNode } from 'vue'
import { Teleport, createVNode, defineComponent, h, inject } from 'vue'
import { useNuxtApp } from '../nuxt'
import { NuxtTeleportIslandSymbol } from './nuxt-teleport-island-component'

/**
 * component only used within islands for slot teleport
 */
/* @__PURE__ */
export default defineComponent({
  name: 'NuxtTeleportIslandSlot',
  props: {
    name: {
      type: String,
      required: true
    },
    /**
     * must be an array to handle v-for
     */
    props: {
      type: Object as () => Array<any>
    }
  },
  setup (props, { slots }) {
    const nuxtApp = useNuxtApp()
    const islandContext = nuxtApp.ssrContext?.islandContext
    if (!islandContext) {
      return () => slots.default?.()[0]
    }

    const componentName = inject(NuxtTeleportIslandSymbol, false)
    islandContext.slots[props.name] = {
      props: (props.props || []) as unknown[]
    }

    return () => {
      const vnodes: VNode[] = []

      if (nuxtApp.ssrContext?.islandContext && slots.default) {
        vnodes.push(h('div', {
          style: 'display: contents;',
          'data-island-uid': '',
          'data-island-slot': props.name
        }, {
          // Teleport in slot to not be hydrated client-side with the staticVNode
          default: () => [createVNode(Teleport, { to: `island-slot=${componentName};${props.name}` }, slots.default?.())]
        }))
      } else {
        vnodes.push(h('div', {
          style: 'display: contents;',
          'data-island-uid': '',
          'data-island-slot': props.name
        }))
      }

      if (slots.fallback) {
        vnodes.push(h(Teleport, { to: `island-fallback=${props.name}` }, slots.fallback()))
      }

      return vnodes
    }
  }
})
