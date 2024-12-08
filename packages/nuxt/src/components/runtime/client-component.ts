import { defineAsyncComponent, defineComponent, h } from 'vue'
import type { AsyncComponentLoader } from 'vue'
import ClientOnly from '#app/components/client-only'
import { useNuxtApp } from '#app/nuxt'

/* @__NO_SIDE_EFFECTS__ */
export const createClientPage = (loader: AsyncComponentLoader) => {
  const page = defineAsyncComponent(import.meta.dev
    ? () => loader().then((m) => {
        // mark component as client-only for `definePageMeta`
        (m.default || m).__clientOnlyPage = true
        return m.default || m
      })
    : loader)

  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const nuxtApp = useNuxtApp()
      if (import.meta.server || nuxtApp.isHydrating) {
        return () => h('div', [
          h(ClientOnly, undefined, {
            default: () => h(page, attrs),
          }),
        ])
      }
      return () => h(page, attrs)
    },
  })
}
