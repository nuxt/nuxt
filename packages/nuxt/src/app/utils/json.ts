const PLUS_RE = /\+/g
const QUOTED_RE = /^"(?:.|[\n\r])*"$/
// https://github.com/unjs/destr/blob/main/src/index.ts#L3-L4
const PROTO_RE = /"(?:_|\\u005[Ff]){2}(?:p|\\u0070)(?:r|\\u0072)(?:o|\\u006[Ff])(?:t|\\u0074)(?:o|\\u006[Ff])(?:_|\\u005[Ff]){2}"\s*:/
// https://github.com/unjs/destr/blob/main/src/index.ts#L5-L6
const CONSTRUCTOR_RE = /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/

export function parseJSON<T = unknown> (value: string, fallback?: T): T {
  if (typeof value !== 'string') {
    return value as T
  }

  const _value = value.trim()

  // Handle primitives (safe fast paths)
  if (_value === 'true') { return true as T }
  if (_value === 'false') { return false as T }
  if (_value === 'null') { return null as T }
  if (_value === 'undefined') { return undefined as T }

  // Handle quoted strings (no number coercion)
  if (QUOTED_RE.test(_value)) {
    try {
      return JSON.parse(_value)
    } catch {
      return _value as T
    }
  }

  // Prototype pollution check
  if (PROTO_RE.test(value) || CONSTRUCTOR_RE.test(value)) {
    try {
      return JSON.parse(value, (key, val) => {
        if (key === '__proto__' || (key === 'constructor' && val && typeof val === 'object' && 'prototype' in val)) {
          return undefined
        }
        return val
      }) as T
    } catch {
      return (fallback ?? value) as T
    }
  }

  try {
    return JSON.parse(value.replace(PLUS_RE, '%2B')) as T
  } catch {
    return (fallback ?? value) as T
  }
}
