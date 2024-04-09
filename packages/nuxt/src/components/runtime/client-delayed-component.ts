import { defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Component, Ref } from 'vue'
import ClientOnly from '#app/components/client-only'
import { useObserver } from '#app/utils'

export const createLazyIOClientPage = (componentLoader: Component) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const isIntersecting = ref(false)
      const el: Ref<Element | null> = ref(null)
      let unobserve: (() => void) | null = null
      onMounted(() => {
        const observer = useObserver()
        unobserve = observer!.observe(el.value as Element, () => {
          isIntersecting.value = true
          unobserve?.()
          unobserve = null
        })
      })
      onBeforeUnmount(() => {
        unobserve?.()
        unobserve = null
      })
      return () => h('div', { ref: el }, [
        h(ClientOnly, undefined, [
          isIntersecting.value ? h(componentLoader, attrs) : null,
        ]),
      ])
    },
  })
}
