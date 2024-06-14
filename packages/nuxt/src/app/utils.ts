export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export type CallbackFn = () => void
export type ObserveFn = (element: Element, callback: CallbackFn) => () => void
