import { fnv1a64Base36 } from 'fnv1a-64'
import { identify } from 'object-identity'

/**
 * Hash an arbitrary value into a short, stable string key.
 *
 * Values are serialized to a canonical, locale-independent representation
 * (equal structures hash equally regardless of key order or runtime locale),
 * then digested with a fast non-cryptographic hash. This is what `useFetch` and
 * `useAsyncData` use internally to derive their cache keys, so it is safe to use
 * for the same purpose in your own code.
 *
 * The digest is non-cryptographic and must not be used for integrity checks.
 *
 * @since 4.5.0
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
// Native function bodies stringify differently across engines (V8 emits
// `{ [native code] }` on one line, JavaScriptCore inserts newlines), so match
// the marker loosely to keep the hash stable between server and client.
const NATIVE_CODE_RE = /\{\s*\[native code\]\s*\}/

export function hashFunction (fn: (...args: any[]) => any): string {
  const src = Function.prototype.toString.call(fn)
  const source = NATIVE_CODE_RE.test(src) ? `${fn.name || ''}(${fn.length})[native]` : src
  return fnv1a64Base36(source)
}
