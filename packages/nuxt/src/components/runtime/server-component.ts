import { defineComponent, h } from 'vue' 
import NuxtIsland from '#app/components/nuxt-island'

export const createServerComponent = (name: string) => {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup (_props, { attrs }) {
      return () => h(NuxtIsland, {
        name,
        props: attrs
      })
    }
  })
}
