import { defineComponent, h, ref } from 'vue'
import NuxtIsland from '#app/components/nuxt-island'
import { useRoute } from '#vue-router'

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
    setup (props, { attrs, slots, expose }) {
      const islandRef = ref<null | typeof NuxtIsland>(null)
      const route = useRoute()
      expose({
        refresh: () => islandRef.value?.refresh()
      })

      return () => {
        return h('div', [h(NuxtIsland, {
          name: `page:${name}`,
          lazy: props.lazy,
          props: attrs,
          ref: islandRef,
          context: { url: route.path }
        }, slots)])
      }
    }
  })
}
