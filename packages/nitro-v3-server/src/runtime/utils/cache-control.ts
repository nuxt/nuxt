import type { H3Event } from 'nitro/h3'

const DIRECTIVE_RE = /[\s,]*([^\s=,"]+)(?:=("(?:[^"\\]|\\.)*"|[^\s,]*))?\s*(?:,[\s,]*|$)/y
const ZERO_RE = /^0+$/

/** The `cache-control` of the `headers` route rule matched for the request. */
export function ruleCacheControl (event: H3Event): string | undefined {
  const headers = event.context?.routeRules?.headers as Record<string, string> | undefined
  for (const name in headers) {
    if (name.toLowerCase() === 'cache-control') {
      return headers[name]?.trim()
    }
  }
}

/**
 * The `cache-control` of an error response that would otherwise be sent with `rule`, such as the
 * `cache-control` of the route rule it falls under.
 *
 * The value is kept when it does not let a shared cache reuse the response without
 * validating it with the origin (RFC 9111): when it has `no-store` without `must-understand`, which
 * lets a cache that understands the status code ignore `no-store`, or an unqualified `private`,
 * or, without `stale-while-revalidate` or `stale-if-error`, when it has an unqualified `no-cache`,
 * `s-maxage=0`, or `max-age=0` with an unqualified `must-revalidate` or `proxy-revalidate` and no
 * `s-maxage`. Any other value, including one that does not parse, is replaced with `no-cache`.
 */
export function errorCacheControl (rule: string | undefined): string {
  const directives = rule ? parseDirectives(rule) : undefined
  if (!directives) {
    return 'no-cache'
  }
  const unqualified = (name: string) => directives.get(name) === true
  if ((directives.has('no-store') && !directives.has('must-understand')) || unqualified('private')) {
    return rule!
  }
  if (directives.has('stale-while-revalidate') || directives.has('stale-if-error')) {
    return 'no-cache'
  }
  if (unqualified('no-cache')) {
    return rule!
  }
  const sharedMaxAge = directives.get('s-maxage')
  const revalidated = sharedMaxAge !== undefined || unqualified('must-revalidate') || unqualified('proxy-revalidate')
  const maxAge = sharedMaxAge ?? directives.get('max-age')
  return revalidated && typeof maxAge === 'string' && ZERO_RE.test(maxAge) ? rule! : 'no-cache'
}

/**
 * The directives of a `cache-control` value by lowercase name, with the value each first appears
 * with. Empty list elements are skipped.
 */
function parseDirectives (value: string): Map<string, string | true> | undefined {
  const input = value.trim()
  const directives = new Map<string, string | true>()
  DIRECTIVE_RE.lastIndex = 0
  while (DIRECTIVE_RE.lastIndex < input.length) {
    const match = DIRECTIVE_RE.exec(input)
    if (!match) {
      return
    }
    const name = match[1]!.toLowerCase()
    if (!directives.has(name)) {
      directives.set(name, match[2] ?? true)
    }
  }
  return directives.size ? directives : undefined
}
