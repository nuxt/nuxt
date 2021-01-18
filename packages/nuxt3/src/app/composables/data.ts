import { getCurrentInstance, reactive, isReactive } from 'vue'
import { useNuxt } from 'nuxt/app'

/**
 * Returns a unique string suitable for syncing data between server and client.
 * @param nuxt (optional) A Nuxt instance
 * @param vm (optional) A Vue component - by default it will use the current instance
 */
export function useSSRRef (nuxt = useNuxt(), vm = getCurrentInstance()): string {
  if (process.server) {
    if (!vm.attrs['data-ssr-ref']) {
      nuxt._refCtr = nuxt._refCtr || 1
      vm.attrs['data-ssr-ref'] = String(nuxt._refCtr++)
    }
    return vm.attrs['data-ssr-ref'] as string
  }

  if (process.client) {
    return vm.vnode.el?.dataset?.ssrRef || String(Math.random()) /* TODO: unique value for multiple calls */
  }
}

/**
 * Allows accessing reactive data that can be synced between server and client.
 * @param nuxt (optional) A Nuxt instance
 * @param vm (optional) A Vue component - by default it will use the current instance
 */
export function useData (nuxt = useNuxt(), vm = getCurrentInstance()): ReturnType<typeof reactive> {
  const ssrRef = useSSRRef(nuxt, vm)

  nuxt.payload.data = nuxt.payload.data || {}

  if (!isReactive(nuxt.payload.data[ssrRef])) {
    nuxt.payload.data[ssrRef] = reactive(nuxt.payload.data[ssrRef] || {})
  }

  return nuxt.payload.data[ssrRef]
}
