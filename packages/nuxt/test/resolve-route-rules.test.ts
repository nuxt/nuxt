import { describe, expect, it } from 'vitest'
import type { NitroRouteRules } from 'nitropack/types'

import { createNormalizedRouteRulesRouter, resolveRouteRules } from '../src/core/utils/route-rules.ts'

function createMatcher (rules: Record<string, NitroRouteRules>, fold = true) {
  return createNormalizedRouteRulesRouter(Object.entries(rules).map(([route, data]) => ({ route, data })), '', fold)
}

describe('resolveRouteRules', () => {
  it('should return the rules themselves rather than the matcher entries', () => {
    const matcher = createMatcher({ '/admin/**': { prerender: true } })
    expect(resolveRouteRules(matcher, '/admin/settings', true)).toEqual({ prerender: true })
  })

  it('should let a more specific rule override a wildcard', () => {
    const matcher = createMatcher({
      '/admin/**': { prerender: true, ssr: false },
      '/admin/live': { prerender: false },
    })
    expect(resolveRouteRules(matcher, '/admin/live', true)).toMatchObject({ prerender: false, ssr: false })
  })

  it('should return an empty object when no rule matches', () => {
    const matcher = createMatcher({ '/admin/**': { prerender: true } })
    expect(resolveRouteRules(matcher, '/about', true)).toEqual({})
  })

  it('should fold casing and decode the lookup path when folding', () => {
    const matcher = createMatcher({ '/Caf\u00E9': { prerender: true } })
    expect(resolveRouteRules(matcher, `/caf${encodeURIComponent('\u00E9')}`, true)).toEqual({ prerender: true })
  })

  it('should respect casing when not folding', () => {
    const matcher = createMatcher({ '/Admin': { prerender: true } }, false)
    expect(resolveRouteRules(matcher, '/Admin', false)).toEqual({ prerender: true })
    expect(resolveRouteRules(matcher, '/admin', false)).toEqual({})
  })
})
