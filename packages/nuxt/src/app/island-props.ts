export type UnsafeIslandPropKey = 'template'

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
