// @ts-expect-error withAsyncContext is exported at runtime but not in Vue's public types
import { getCurrentInstance, withAsyncContext } from 'vue'

export function clearVueCurrentInstance (): void {
  if (getCurrentInstance()) {
    // HACK: using `withAsyncContext` to clear `currentInstance` until Vue exports an equivalent public API
    withAsyncContext(() => null)
  }
}
