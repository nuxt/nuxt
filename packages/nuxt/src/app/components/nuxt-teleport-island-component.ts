import type { Component, DefineSetupFnComponent, InjectionKey, SlotsType, VNode } from 'vue'
import { Teleport, defineComponent, h, inject, provide, useId } from 'vue'
import { useNuxtApp } from '../nuxt'
import { isVaporSlot } from './utils'
import paths from '#build/component-chunk'
import { buildAssetsURL } from '#internal/nuxt/paths'

type ExtendedComponent = Component & {
  __file: string
  __name: string
}

export const NuxtTeleportIslandSymbol = Symbol('NuxtTeleportIslandComponent') as InjectionKey<false | string>

/**
 * component only used with componentsIsland
 * this teleport the component in SSR only if it needs to be hydrated on client
 */
interface NuxtTeleportIslandComponentProps {
  nuxtClient?: boolean
}

type NuxtTeleportIslandComponentSlots = SlotsType<{
  default?: () => VNode[]
}>

const NuxtTeleportIslandComponent = /* @__PURE__ */ defineComponent({
  name: 'NuxtTeleportIslandComponent',
  inheritAttrs: false,
  props: {
    nuxtClient: {
      type: Boolean,
      default: false,
    },
  },
  setup (props, { slots }) {
    const nuxtApp = useNuxtApp()
    const to = useId()

    // if there's already a teleport parent, we don't need to teleport or to render the wrapped component client side
    if (!nuxtApp.ssrContext?.islandContext || !props.nuxtClient || inject(NuxtTeleportIslandSymbol, false)) { return () => slots.default?.() }

    provide(NuxtTeleportIslandSymbol, to)
    const islandContext = nuxtApp.ssrContext!.islandContext!

    return () => {
      if (import.meta.dev && isVaporSlot(slots.default)) {
        console.warn('[nuxt] a vapor component cannot be teleported as an interactive island. Island client hydration reads the wrapped component from its VNode, which a vapor slot does not expose. Use a vdom component for `nuxtClient` islands.')
      }
      const slot = slots.default!()[0]!
      const slotType = slot.type as ExtendedComponent
      const name = (slotType.__name || slotType.name) as string

      islandContext.components[to] = {
        chunk: import.meta.dev ? buildAssetsURL(paths[name]) : paths[name],
        props: slot.props || {},
      }

      return [h('div', {
        'style': 'display: contents;',
        'data-island-uid': '',
        'data-island-component': to,
      }, []), h(Teleport, { to }, slot)]
    }
  },
}) as unknown as DefineSetupFnComponent<NuxtTeleportIslandComponentProps, {}, NuxtTeleportIslandComponentSlots>

export default NuxtTeleportIslandComponent
