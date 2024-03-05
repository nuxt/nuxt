import { defineComponent, h, ref } from 'vue'
import NuxtIsland from '#app/components/nuxt-island'
import { useRoute } from '#app/composables/router'
import { isPrerendered } from '#app/composables/payload'

/*@__NO_SIDE_EFFECTS__*/
export const createServerComponent = (name: string) => {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: { lazy: Boolean },
    setup (props, { attrs, slots, expose }) {
      const islandRef = ref<null | typeof NuxtIsland>(null)

      expose({
        refresh: () => islandRef.value?.refresh()
      })

      return () => {
        return h(NuxtIsland, {
          name,
          lazy: props.lazy,
          props: attrs,
          ref: islandRef
        }, slots)
      }
    }
  })
}

/*@__NO_SIDE_EFFECTS__*/
export const createIslandPage = (name: string) => {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: { lazy: Boolean },
    async setup (props, { slots, expose }) {
      const islandRef = ref<null | typeof NuxtIsland>(null)

      expose({
        refresh: () => islandRef.value?.refresh()
      })

      const route = useRoute()
      const path = import.meta.client && await isPrerendered(route.path) ? route.path : route.fullPath.replace(/#.*$/, '')

      return () => {
        return h('div', [
          h(NuxtIsland, {
            name: `page:${name}`,
            lazy: props.lazy,
            ref: islandRef,
            context: { url: path }
          }, slots)
        ])
      }
    }
  })
}
