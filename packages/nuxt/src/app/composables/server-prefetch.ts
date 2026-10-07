import { getCurrentInstance } from 'vue'
import type { ComponentInternalInstance } from 'vue'

/** Client-side `onServerPrefetch`, which only keeps the component a `useId()` async boundary. */
export function onServerPrefetch (): void {
  const instance = getCurrentInstance() as (ComponentInternalInstance & { sp?: unknown[] }) | null
  if (instance && !instance.sp) {
    instance.sp = []
  }
}
