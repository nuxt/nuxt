import type { Component } from 'vue'
import { Teleport, defineComponent, h } from 'vue'
import { useNuxtApp } from '../nuxt'
// @ts-expect-error virtual file
import { paths } from '#build/components-chunk'

type ExtendedComponent = Component & {
  __file: string,
  __name: string
}

/**
 * component only used with componentsIsland
 * this teleport the component in SSR only if it needs to be hydrated on client
 */
/* @__PURE__ */
export default defineComponent({
  name: 'NuxtTeleportIslandComponent',
  props: {
    to: {
      type: String,
      required: true
    },
    nuxtClient: {
      type: Boolean,
      default: false
    },
    /**
     * ONLY used in dev mode since we use build:manifest result in production
     * do not pass any value in production
     */
    rootDir: {
      type: String,
      default: null
    }
  },
  setup (props, { slots }) {
    const nuxtApp = useNuxtApp()

    if (!nuxtApp.ssrContext?.islandContext || !props.nuxtClient) { return () => slots.default!() }

    const islandContext = nuxtApp.ssrContext!.islandContext!

    return () => {
      const slot = slots.default!()[0]
      const slotType = (slot.type as ExtendedComponent)
      const name = (slotType.__name || slotType.name) as string

      islandContext.components[props.to] = {
        chunk: import.meta.dev ? '_nuxt/' + paths[name] : paths[name],
        props: slot.props || {}
      }

      return [h('div', {
        style: 'display: contents;',
        'data-island-uid': '',
        'data-island-component': props.to
      }, []), h(Teleport, { to: props.to }, slot)]
    }
  }
})
