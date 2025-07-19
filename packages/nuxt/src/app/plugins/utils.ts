const VALID_ISLAND_KEY_RE = /^[A-Za-z][A-Za-z0-9-]*_[A-Za-z0-9]+$/
/**
 * @__PURE__
 */
export function isValidIslandKey(key: string): boolean {
    return typeof key === 'string' && VALID_ISLAND_KEY_RE.test(key) && key.length <= 100
}