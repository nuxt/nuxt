const useIdKeyPrefix = '$id'

export function useId(): string
export function useId (...args: any): string {
  const key = args[0]
  if (typeof key !== 'string') {
    throw new TypeError(`[nuxt] [useId] key must be a string: ${key}}`)
  }

  return useIdKeyPrefix + key
}
