export function toArray<T> (value: T | T[] | undefined): T[] {
  return Array.isArray(value) ? value : (value ? [value] : [])
}
