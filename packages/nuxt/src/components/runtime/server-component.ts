import { DefineComponent, defineComponent, h, ref } from 'vue'

/**
 * Since NuxtIsland is split into a server and client file
 * we need to pass it as an argument to createServerComponent
 * It is normally injected by transform plugins
 */
/*@__NO_SIDE_EFFECTS__*/
export const createServerComponent = (name: string, NuxtIsland: DefineComponent) => {
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
