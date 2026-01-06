const PLUS_RE = /\+/g
const QUOTED_RE = /^"(?:.|[\n\r])*"$/

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

  // Prototype pollution check (same as destr)
  if (/"(?:__proto__|constructor)"\s*:/.test(value)) {
    try {
      return JSON.parse(value, (key, val) => {
        if (key === '__proto__' || key === 'constructor') { return undefined }
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
