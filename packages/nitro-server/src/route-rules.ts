import { defu } from 'defu'

// bare placeholders only: renaming `:id(\d+)` or `:slug?` would change what they match
const DYNAMIC_SEGMENT_RE = /^(?::[$\w]+|\*)$/

// a name conflicts if another segment carries it and cannot itself be renamed away
function conflictsWithin (segments: string[], name: string, index: number): boolean {
  return segments.some((segment, i) =>
    i !== index &&
    segment.match(/^:([$\w]+)/)?.[1] === name &&
    (i < index || !DYNAMIC_SEGMENT_RE.test(segment)),
  )
}

/**
 * Rename dynamic segments in route rule keys, in place, so sibling segments share a single name.
 * `radix3` keys dynamic segments without their placeholder name, so `/:slug/about` and
 * `/:locale/:slug/about` collide and one silently loses its rules. Rule objects are not mutated:
 * a rule whose `redirect` or `proxy` target is rewritten is replaced with a copy.
 *
 * @returns each renamed key, mapped to its new name
 * @internal
 */
export function unifyDynamicRouteRuleSegments (routeRules: Record<string, Record<string, any>>): Map<string, string> {
  const unifiedNames = new Map<string, string>()
  const unified: Array<[string, Record<string, any>]> = []
  const renamedKeys = new Map<string, string>()

  for (const [route, original] of Object.entries(routeRules)) {
    let rules = original
    const segments = route.split('/')
    const renames = new Map<string, string>()
    for (let index = 1; index < segments.length; index++) {
      const segment = segments[index]!
      if (!DYNAMIC_SEGMENT_RE.test(segment)) { continue }
      const group = segments.slice(0, index).join('/')
      let name = unifiedNames.get(group)
      if (!name) {
        name = segment === '*' ? `_${index}` : segment.slice(1)
        while (conflictsWithin(segments, name, index)) {
          name += '_'
        }
        unifiedNames.set(group, name)
      }
      if (segment === `:${name}` || conflictsWithin(segments, name, index)) { continue }
      segments[index] = `:${name}`
      if (segment !== '*') {
        renames.set(segment.slice(1), name)
      }
    }
    if (renames.size) {
      // redirect/proxy targets reference placeholders by name
      for (const key of ['redirect', 'proxy']) {
        const target = rules[key]
        if (target?.to) {
          rules = { ...rules, [key]: { ...target, to: target.to.replace(/\/:([$\w]+)/g, (match: string, name: string) => renames.has(name) ? `/:${renames.get(name)}` : match) } }
        }
      }
    }
    const key = segments.join('/')
    if (key !== route) {
      renamedKeys.set(route, key)
    }
    unified.push([key, rules])
  }

  if (!renamedKeys.size) { return renamedKeys }

  for (const route of Object.keys(routeRules)) {
    delete routeRules[route]
  }
  for (const [route, rules] of unified) {
    routeRules[route] = route in routeRules ? defu(rules, routeRules[route]) : rules
  }
  return renamedKeys
}
