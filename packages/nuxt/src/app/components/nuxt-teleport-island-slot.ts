import { defineComponent, h } from 'vue'
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

    return () => {
      islandContext.slots[props.name] = {
        props: (props.props ||  []) as unknown[]
      }

      return [h('div', {
        style: 'display: contents;',
        'data-island-uid': islandContext.uid,
        'data-island-slot': props.name,
      }, [])]
    }
  }
})
