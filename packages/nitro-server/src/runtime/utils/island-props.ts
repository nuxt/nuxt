// Guards applied to the raw island request body before it is parsed and hashed, so an
// oversized or deeply nested payload is rejected before that work runs on unauthenticated
// input.

/** @internal */
export const MAX_ISLAND_BODY_BYTES = 64 * 1024

/** @internal */
export const MAX_ISLAND_PROP_DEPTH = 64

/**
 * Whether the bracket nesting of a JSON-ish string exceeds `maxDepth`, in a single linear
 * pass. Brackets inside string values are ignored.
 *
 * @internal
 */
export function exceedsMaxDepth (raw: string, maxDepth = MAX_ISLAND_PROP_DEPTH): boolean {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '{' || ch === '[') {
      if (++depth > maxDepth) {
        return true
      }
    } else if (ch === '}' || ch === ']') {
      if (depth > 0) {
        depth--
      }
    }
  }
  return false
}

/** @internal */
export function exceedsMaxBytes (raw: string, maxBytes = MAX_ISLAND_BODY_BYTES): boolean {
  return Buffer.byteLength(raw, 'utf8') > maxBytes
}
