/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

/**
 * Turbo-charged in-place array filtering. This function mutates the array.
 * Optimized for both small and large arrays using different strategies:
 * - For small arrays (<=16 items): Uses splice for better memory efficiency
 * - For large arrays: Uses optimized swap-and-truncate strategy
 *
 * Processes array from end to start for maximum performance.
 * Benchmarks show this is significantly faster than Array.prototype.filter
 * and standard filterInPlace implementations.
 */
export function filterInPlace<T> (array: T[], predicate: (item: T, index: number, arr: T[]) => unknown) {
  let i = array.length

  if (i <= 16) {
    while (i--) {
      if (!predicate(array[i]!, i, array)) {
        array.splice(i, 1)
      }
    }
  } else {
    while (i--) {
      if (!predicate(array[i]!, i, array)) {
        const last = --array.length
        if (i < last) {
          array[i] = array[last] as T
        }
      }
    }
  }

  return array
}

export const MODE_RE = /\.(server|client)(\.\w+)*$/
