import { computed, defineComponent, h } from 'vue'
import NuxtIsland from '#app/components/nuxt-island'

export const createServerComponent = (name: string) => {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: { lazy: Boolean },
    setup (props, { attrs, slots }) {
      // #23051 - remove data-v attributes
      const attrsWithoutVueDataAttr = computed(() => Object.entries(attrs).reduce<Record<string, string>>((acc, [key, value]) => key.startsWith('data-v-') ? acc : Object.assign(acc, { [key]: value }), {}))
      return () => h(NuxtIsland, {
        name,
        lazy: props.lazy,
        props: attrsWithoutVueDataAttr
      }, slots)
    }
  })
}
