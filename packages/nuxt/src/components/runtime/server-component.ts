import { defineComponent, h } from 'vue'
import NuxtIsland from '#app/components/nuxt-island'

/*! @__NO_SIDE_EFFECTS__ */
export const createServerComponent = (name: string) => {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: { lazy: Boolean },
    setup (props, { attrs, slots }) {
      return () => {
        return h(NuxtIsland, {
          name,
          lazy: props.lazy,
          props: attrs
        }, slots)
      }
    }
  })
}
