import { defineAsyncComponent, defineComponent, h } from "vue";
import type { AsyncComponentLoader} from 'vue'
import { default as ClientOnly } from '#app/components/client-only'

export const createClientPage = (loader: AsyncComponentLoader) => {
  const page = defineAsyncComponent(loader);

  return defineComponent({
    inheritAttrs: false,
    setup() {
      return () => h('div', [
        h(ClientOnly, undefined, {
          default: () => h(page)
        })
      ])
    }
  })
}
