import { defineComponent, h } from 'vue'
// @ts-expect-error virtual import
import { NuxtIsland } from '#components'

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
