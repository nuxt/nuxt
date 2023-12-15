// @ts-expect-error withAsyncContext is internal API
import { getCurrentInstance, withAsyncContext as withVueAsyncContext } from 'vue'

export function withNuxtContext <T>(fn: () => T) {
  const nuxtApp = getCurrentInstance()?.appContext.app.$nuxt
  return nuxtApp ? nuxtApp.runWithContext(fn) : fn()
}

export function withAsyncContext (fn: () => PromiseLike<unknown>) {
  return withVueAsyncContext(() => withNuxtContext(fn))
}
