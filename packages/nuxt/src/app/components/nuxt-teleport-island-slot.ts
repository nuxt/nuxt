import { defineComponent, h, Teleport } from 'vue'
import { useNuxtApp } from '../nuxt'
// @ts-expect-error virtual file
import { paths } from '#build/components-chunk'
 
/**
 * component only used within islands for slot teleport
 */
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
    const islandContext = nuxtApp.ssrContext!.islandContext!

    islandContext.slots[props.name] = {
      props: (props.props ||  []) as unknown[]
    }

    return () => {
      const vnodes = [h('div', {
        style: 'display: contents;',
        'data-island-uid': '',
        'data-island-slot': props.name,
      })]

      if (slots.fallback) {
        vnodes.push(h(Teleport, { to: `island-fallback=${islandContext.uid};${props.name}`}, slots.fallback()))
      }

      return vnodes
    }
  }
})
