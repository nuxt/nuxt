import { relative } from 'node:path'
import type { Component } from 'vue'
import { Teleport, defineComponent, h } from 'vue'
import { useNuxtApp } from '#app'
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
export default defineComponent({
  name: 'NuxtTeleportSsrClient',
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
    const app = useNuxtApp()

    const islandContext = app.ssrContext!.islandContext!

    const slot = slots.default!()[0]
    const slotType = (slot.type as ExtendedComponent)

    if (process.dev) {
      const path = '_nuxt/' + relative(props.rootDir, slotType.__file)

      islandContext.chunks[slotType.__name] = path
    } else {
      islandContext.chunks[slotType.__name] = paths[slotType.__name]
    }

    islandContext.propsData[props.to] = slot.props || {}
    return () => {
      if (props.nuxtClient) {
        return [h('div', {
          style: 'display: contents;',
          'nuxt-ssr-client': props.to
        }, []), h(Teleport, { to: props.to }, slot)]
      }

      return slot
    }
  }
})
