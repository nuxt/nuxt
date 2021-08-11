import { getCurrentInstance, isReactive, reactive } from 'vue'
import type { UnwrapRef } from 'vue'
import { useNuxt } from '#app'

export function ensureReactive<
  T extends Record<string, any>,
  K extends keyof T
> (data: T, key: K): UnwrapRef<T[K]> {
  if (!isReactive(data[key])) {
    data[key] = reactive(data[key] || ({} as T[K]))
  }
  return data[key]
}

/**
 * Returns a unique string suitable for syncing data between server and client.
 *
 * @param nuxt (optional) A Nuxt instance
 * @param vm (optional) A Vue component - by default it will use the current instance
 */
export function useSSRRef (nuxt = useNuxt(), vm = getCurrentInstance()): string {
  if (!vm) {
    throw new Error('This must be called within a setup function.')
  }

  // Server
  if (process.server) {
    if (!vm.attrs['data-ssr-ref']) {
      nuxt._refCtr = nuxt._refCtr || 1
      vm.attrs['data-ssr-ref'] = String(nuxt._refCtr++)
    }
    return vm.attrs['data-ssr-ref'] as string
  }

  // Client
  /* TODO: unique value for multiple calls */
  return vm.vnode.el?.dataset?.ssrRef || String(Math.random())
}

/**
 * Allows accessing reactive data that can be synced between server and client.
 *
 * @param nuxt (optional) A Nuxt instance
 * @param vm (optional) A Vue component - by default it will use the current instance
 */
export function useData<T = Record<string, any>> (
  nuxt = useNuxt(),
  vm = getCurrentInstance()
): UnwrapRef<T> {
  const ssrRef = useSSRRef(nuxt, vm)

  nuxt.payload.data = nuxt.payload.data || {}

  return ensureReactive(nuxt.payload.data, ssrRef)
}

/**
 * Allows accessing reactive global data that can be synced between server and client.
 *
 * @param nuxt - (optional) A Nuxt instance
 */
export function useGlobalData (nuxt = useNuxt()): Record<string, any> {
  nuxt.payload.data = nuxt.payload.data || {}
  return nuxt.payload.data
}
