const getUniqueIDKeyPrefix = '$id'

export function getUniqueID(): string
export function getUniqueID (...args: any): string {
  const key = args[0]
  if (typeof key !== 'string') {
    throw new TypeError(`[nuxt] [getUniqueID] key must be a string: ${key}}`)
  }

  return getUniqueIDKeyPrefix + key
}
