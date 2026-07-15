import { fnv1a64Base36 } from 'fnv1a-64'
import { identify } from 'object-identity'

/**
 * Derive a stable key from an arbitrary value for cache/map lookups.
 *
 * The digest is non-cryptographic and must not be used for integrity checks.
 *
 * @internal
 */
export function hashKey (value: unknown): string {
  return fnv1a64Base36(identify(value))
}

/**
 * Derive a stable key from a function's source.
 *
 * Functions are hashed from their source text (or name/arity for native functions).
 *
 * @internal
 */
export function hashFunction (fn: (...args: any[]) => any): string {
  const src = Function.prototype.toString.call(fn)
  const source = src.endsWith('[native code] }') ? `${fn.name || ''}(${fn.length})[native]` : src
  return fnv1a64Base36(source)
}
