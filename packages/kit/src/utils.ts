/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

/**
 * Filter out items from an array in place. This function mutates the array.
 * `predicate` get through the array from the end to the start for performance.
 *
 * This function should be faster than `Array.prototype.filter` on large arrays.
 */
export function filterInPlace<T> (array: T[], predicate: (item: T, index: number, arr: T[]) => unknown) {
  for (let i = array.length; i--; i >= 0) {
    if (!predicate(array[i]!, i, array)) {
      array.splice(i, 1)
    }
  }
  return array
}

export const MODE_RE = /\.(server|client)(\.\w+)*$/

export const distDirURL = new URL('.', import.meta.url)

export type RequirePicked<T extends Record<string, any>, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>
