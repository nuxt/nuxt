import type { Component } from 'vue'

export type UnsafeIslandPropKey = 'template'
export type ReservedRootIslandPropKey = 'as' | 'hasOwnProperty'

const RESERVED_ROOT_ISLAND_PROP_KEYS: ReservedRootIslandPropKey[] = ['as', 'hasOwnProperty']

/**
 * Find a `template` key anywhere in island props. With the Vue runtime compiler bundled, a
 * `template` string reaching component resolution would be compiled and executed. (`render`
 * is not checked: props arrive as JSON, so it can only be an inert string, never a function.)
 *
 * @internal
 */
export function findUnsafeIslandPropKey (value: unknown): UnsafeIslandPropKey | undefined {
  const pending = [value]
  const seen = new Set<object>()

  while (pending.length) {
    const current = pending.pop()
    if (!current || typeof current !== 'object' || seen.has(current)) {
      continue
    }
    seen.add(current)

    for (const key of Object.keys(current)) {
      if (key === 'template') {
        return key
      }
      pending.push((current as Record<string, unknown>)[key])
    }
  }
}

/**
 * Find a request-supplied reserved prop that the island does not declare. An undeclared prop
 * falls through as an attribute onto the island's root:
 * - `as` on a polymorphic root (e.g. `reka-ui` / `@nuxt/ui`) drives dynamic component resolution.
 * - `hasOwnProperty` on a custom element (or `h('svg')`) root overwrites the method on Vue's process-wide
 *   SSR attribute name cache, so every later render with dynamic attributes throws.
 *
 * A `^`-prefixed key is matched too, since the SSR renderer strips that prefix from attribute
 * names. A declared prop is the island's own API and is left alone, as is an `as` sent to an
 * island that opts out of attribute inheritance. `hasOwnProperty` is rejected even then, since
 * such islands commonly forward `$attrs` to an inner element and the key has no legitimate use
 * as an attribute. Only the top level is checked; props the author forwards elsewhere are their
 * responsibility.
 *
 * @internal
 */
export function findReservedRootIslandPropKey (value: unknown, component: Component): ReservedRootIslandPropKey | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return
  }
  const options = component as { props?: string[] | Record<string, unknown>, inheritAttrs?: boolean }
  for (const key of Object.keys(value)) {
    const attr = (key[0] === '^' ? key.slice(1) : key) as ReservedRootIslandPropKey
    if (!RESERVED_ROOT_ISLAND_PROP_KEYS.includes(attr) || declaresProp(options.props, key)) {
      continue
    }
    if (attr === 'as' && options.inheritAttrs === false) {
      continue
    }
    return attr
  }
}

function declaresProp (props: string[] | Record<string, unknown> | undefined, name: string): boolean {
  if (!props) {
    return false
  }
  return Array.isArray(props) ? props.includes(name) : Object.hasOwn(props, name)
}
