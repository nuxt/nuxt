// @ts-expect-error withAsyncContext is internal API
import { getCurrentInstance, withAsyncContext as withVueAsyncContext } from 'vue'

/** @since 3.8.0 */
export function withAsyncContext (fn: () => PromiseLike<unknown>) {
  if (import.meta.client) {
    return withVueAsyncContext(fn)
  }

  return withVueAsyncContext(() => {
    const nuxtApp = getCurrentInstance()?.appContext.app.$nuxt
    return nuxtApp ? nuxtApp.runWithContext(fn) : fn()
  })
}
