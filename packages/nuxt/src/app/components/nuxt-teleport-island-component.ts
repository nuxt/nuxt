import type { Component, InjectionKey } from 'vue'
import { Teleport, defineComponent, h, inject, provide } from 'vue'
import { useNuxtApp } from '../nuxt'
// @ts-expect-error virtual file
import { paths } from '#build/components-chunk'

type ExtendedComponent = Component & {
  __file: string
  __name: string
}

export const NuxtTeleportIslandSymbol = Symbol('NuxtTeleportIslandComponent') as InjectionKey<false | string>

/**
 * component only used with componentsIsland
 * this teleport the component in SSR only if it needs to be hydrated on client
 */
/* @__PURE__ */
export default defineComponent({
  name: 'NuxtTeleportIslandComponent',
  inheritAttrs: false,
  props: {
    to: {
      type: String,
      required: true,
    },
    nuxtClient: {
      type: Boolean,
      default: false,
    },
  },
  setup (props, { slots }) {
    const nuxtApp = useNuxtApp()

    // if there's already a teleport parent, we don't need to teleport or to render the wrapped component client side
    if (!nuxtApp.ssrContext?.islandContext || !props.nuxtClient || inject(NuxtTeleportIslandSymbol, false)) { return () => slots.default?.() }

    provide(NuxtTeleportIslandSymbol, props.to)
    const islandContext = nuxtApp.ssrContext!.islandContext!

    return () => {
      const slot = slots.default!()[0]
      const slotType = slot.type as ExtendedComponent
      const name = (slotType.__name || slotType.name) as string

      islandContext.components[props.to] = {
        chunk: import.meta.dev ? nuxtApp.$config.app.buildAssetsDir + paths[name] : paths[name],
        props: slot.props || {},
      }

      return [h('div', {
        'style': 'display: contents;',
        'data-island-uid': '',
        'data-island-component': props.to,
      }, []), h(Teleport, { to: props.to }, slot)]
    }
  },
})
