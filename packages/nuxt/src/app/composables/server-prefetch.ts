import { getCurrentInstance } from 'vue'
import type { ComponentInternalInstance } from 'vue'

/** Client-side `onServerPrefetch`, which only keeps the component a `useId()` async boundary. */
export function onServerPrefetch (target: ComponentInternalInstance | null = getCurrentInstance()): void {
  const instance = target as (ComponentInternalInstance & { sp?: unknown[] }) | null
  if (instance && !instance.sp) {
    instance.sp = []
  }
}
