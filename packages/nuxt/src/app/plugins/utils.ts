const VALID_ISLAND_KEY_RE = /^[a-z][\w-]*_[a-z\d]+$/i
export function isValidIslandKey (key: unknown): key is string {
  return typeof key === 'string' && VALID_ISLAND_KEY_RE.test(key) && key.length <= 100
}
