import { relative } from 'node:path'
import { Teleport, defineComponent, h } from 'vue'
import { useNuxtApp } from '#app'
// @ts-expect-error virtual file
import { paths } from '#build/components-chunk'

/**
 * component only used with componentsIsland
 * this teleport the component in SSR only if
 */
export default defineComponent({
  name: 'TeleportIfClient',
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
    if (process.dev) {
      const path = '_nuxt/' + relative(props.rootDir, slot.type.__file)

      islandContext.chunks[slot.type.__name] = path
    } else { 
      islandContext.chunks[slot.type.__name] = paths[slot.type.__name]
    }
    // todo chunk path in production
    islandContext.propsData[props.to] = slot.props || {}
    // todo set prop in payload
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
