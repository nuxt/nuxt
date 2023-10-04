// @ts-expect-error Private Vue API
import { withAsyncContext as withVueAsyncContext } from 'vue'

import { useNuxtApp } from '#app/nuxt'

export function withAsyncContext (fn: () => PromiseLike<unknown>) {
  return withVueAsyncContext(() => useNuxtApp().runWithContext(fn))
}
