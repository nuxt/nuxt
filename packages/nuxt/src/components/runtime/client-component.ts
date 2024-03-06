import { defineAsyncComponent, defineComponent, h } from 'vue'
import type { AsyncComponentLoader } from 'vue'
import { default as ClientOnly } from '#app/components/client-only'

/*@__NO_SIDE_EFFECTS__*/
export const createClientPage = (loader: AsyncComponentLoader) => {
  const page = defineAsyncComponent(loader)

  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      return () => h('div', [
        h(ClientOnly, undefined, {
          default: () => h(page, attrs)
        })
      ])
    }
  })
}
