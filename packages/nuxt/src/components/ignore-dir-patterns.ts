import type { IgnoreDirPatterns } from 'nuxt/schema'

/**
 * Normalize the user-facing `ignoreDirPatterns` value onto the per-pattern
 * flags shape used during scanning. Returns `null` when no pattern is enabled.
 *
 * - `true`  → both patterns enabled
 * - object  → only the enabled patterns
 * - falsy   → `null`
 */
export function resolveIgnoreDirPatterns (value: boolean | IgnoreDirPatterns | undefined): IgnoreDirPatterns | null {
  if (!value) { return null }
  const config: IgnoreDirPatterns = value === true
    ? { wrap: true, prefix: true }
    : { wrap: !!value.wrap, prefix: !!value.prefix }
  if (!config.wrap && !config.prefix) { return null }
  return config
}

/**
 * Return `true` if the folder name should be treated as "organizational" and
 * stripped from the generated component name, given the enabled patterns.
 *
 * Recognized patterns (fixed for the initial release — additional delimiters
 * may be added in future releases in a non-breaking way):
 *   - `wrap`: `(something)` — parens
 *   - `prefix`: `_something` — underscore
 */
export function dirNameMatchesIgnorePatterns (name: string, config: IgnoreDirPatterns): boolean {
  if (config.wrap && name.length > 2 && name[0] === '(' && name[name.length - 1] === ')') { return true }
  if (config.prefix && name.length > 1 && name[0] === '_') { return true }
  return false
}
