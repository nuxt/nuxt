const VALID_ISLAND_KEY_RE = /^[a-z][a-z\d-]*_[a-z\d]+$/i
/* @__PURE__ */
export function isValidIslandKey (key: string): boolean {
  return typeof key === 'string' && VALID_ISLAND_KEY_RE.test(key) && key.length <= 100
}
