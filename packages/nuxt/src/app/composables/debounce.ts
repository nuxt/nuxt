import { ref, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * Debounce a reactive value or ref with a specified delay.
 *
 * Returns a ref that updates after `ms` milliseconds of inactivity.
 * Useful for search inputs, resize handlers, and other high-frequency events.
 *
 * @param value - A ref or getter function returning the value to debounce
 * @param ms - Delay in milliseconds (default: 200)
 * @returns A ref that is lazily updated with the debounced value
 * @since 4.0.0
 */
export function useDebounce<T> (value: Ref<T> | (() => T), ms = 200): Ref<T> {
  const debounced = ref<T>((typeof value === 'function' ? value() : value.value) as T) as Ref<T>

  if (import.meta.client) {
    let timeout: ReturnType<typeof setTimeout> | undefined
    watch(value, (val) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        debounced.value = val as T
      }, ms)
    })
  }

  return debounced
}
