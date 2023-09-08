import { defineComponent, h } from 'vue'
import NuxtIsland from '#app/components/nuxt-island'

export const createServerComponent = (name: string) => {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: { lazy: Boolean },
    setup (props, { attrs, slots }) {
      // #23051
      const attrsWithoutVueDataAttr = Object.entries(attrs).reduce<Record<string, string>>((acc, [key, value]) => key.startsWith('data-v-') ? acc : Object.assign(acc, { [key]: value }), {})
      return () => h(NuxtIsland, {
        name,
        lazy: props.lazy,
        props: attrsWithoutVueDataAttr
      }, slots)
    }
  })
}
