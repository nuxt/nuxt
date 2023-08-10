import { relative } from 'node:path'
import { Teleport, defineComponent, h } from 'vue'
import { useNuxtApp } from '#app'
// todo import manifest in production

/**
 * component only used with componentsIsland
 * this teleport the component in SSR only if
 */
export default defineComponent({
  name: 'TeleportIfClient',
  props: {
    to: String,
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

    const islandContext = app.ssrContext!.islandContext

    const slot = slots.default!()[0]
    console.log(slot)
    if (process.dev) {
      console.log(app)
      const path = '_nuxt/' + relative(props.rootDir, slot.type.__file)

      islandContext.chunks[slot.type.__name] = path
    }
    // todo chunk path in production
    islandContext.propsData[props.to] = slot.props || {}
    // todo set prop in payload
    return () => {
      if (props.nuxtClient) {
        return [h('div', {
          style: 'display: contents;',
          'nuxt-ssr-client': props.to
        }, [slot]), h(Teleport, { to: props.to }, slot)]
      }

      return slot
    }
  }
})
