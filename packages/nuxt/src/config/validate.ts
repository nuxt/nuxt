import { optionsDiagnostics } from './diagnostics.ts'

/** A `nuxt.config`, or one of its namespaces, before it has been checked. */
export type RawConfig = Record<string, any>

export function isObject (value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object'
}

export function isPlainObject (value: unknown): value is Record<string, any> {
  if (!isObject(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function objectOrEmpty (value: unknown): Record<string, any> {
  return isObject(value) ? value : {}
}

function formatValue (value: unknown): string {
  if (Array.isArray(value)) {
    return 'an array'
  }
  if (typeof value === 'function') {
    return 'a function'
  }
  if (isObject(value)) {
    return 'an object'
  }
  return `\`${typeof value === 'string' ? JSON.stringify(value) : String(value)}\``
}

export function warnInvalid (path: string, value: unknown, expected: string): void {
  optionsDiagnostics.NUXT_B5041({ path, value: formatValue(value), expected })
}

export function bool (path: string, value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (value != null) {
    warnInvalid(path, value, 'a boolean')
  }
  return fallback
}

export function string<T extends string | undefined> (path: string, value: unknown, fallback: T): string | T {
  if (typeof value === 'string') {
    return value || fallback
  }
  if (value != null) {
    warnInvalid(path, value, 'a string')
  }
  return fallback
}

export function oneOf<const T> (path: string, value: unknown, values: readonly T[], fallback: NoInfer<T>): T {
  if (values.includes(value as T)) {
    return value as T
  }
  if (value != null) {
    warnInvalid(path, value, `one of ${values.map(v => `\`${JSON.stringify(v)}\``).join(', ')}`)
  }
  return fallback
}

/**
 * The value with `defaults` filled in. Nested non-empty plain objects in `defaults` are merged key
 * by key, other defaults are used when the value is `undefined`. Keys without a default are kept.
 */
export function withDefaults (path: string, value: unknown, defaults: RawConfig): RawConfig {
  if (value == null) {
    return defaults
  }
  if (!isPlainObject(value)) {
    warnInvalid(path, value, 'an object')
    return defaults
  }
  const result: RawConfig = { ...value }
  for (const key in defaults) {
    if (isPlainObject(defaults[key]) && Object.keys(defaults[key]).length) {
      result[key] = withDefaults(`${path}.${key}`, value[key], defaults[key])
    } else if (result[key] === undefined) {
      result[key] = defaults[key]
    }
  }
  return result
}
