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

  it.each([true, false])('should keep the case of escape sequences in regex constraints (fold: %s)', (fold) => {
    const matcher = createMatcher({ '/x/:id(\\D+)': { prerender: true } }, fold)
    expect(resolveRouteRules(matcher, '/x/abc', fold)).toEqual({ prerender: true })
    expect(resolveRouteRules(matcher, '/x/123', fold)).toEqual({})
  })

  it('should match regex constraints as written against the folded path when folding', () => {
    const matcher = createMatcher({ '/X/:id([A-z]+)': { prerender: true }, '/Y/:role(admin|user)': { ssr: false } })
    expect(resolveRouteRules(matcher, '/x/ABC', true)).toEqual({ prerender: true })
    expect(resolveRouteRules(matcher, '/x/abc', true)).toEqual({ prerender: true })
    expect(resolveRouteRules(matcher, '/X/_', true)).toEqual({ prerender: true })
    expect(resolveRouteRules(matcher, '/x/123', true)).toEqual({})
    expect(resolveRouteRules(matcher, '/y/Admin', true)).toEqual({ ssr: false })
  })

  it('should match uppercase text in regex constraints by case when not folding', () => {
    const matcher = createMatcher({ '/x/:id([A-Z]+)': { prerender: true } }, false)
    expect(resolveRouteRules(matcher, '/x/ABC', false)).toEqual({ prerender: true })
    expect(resolveRouteRules(matcher, '/x/abc', false)).toEqual({})
  })

  it('should match a literal character percent-encoded in a constraint', () => {
    const matcher = createMatcher({ '/x/:id(a%2Eb)': { prerender: true } })
    expect(resolveRouteRules(matcher, '/x/a.b', true)).toEqual({ prerender: true })
    expect(resolveRouteRules(matcher, '/x/axb', true)).toEqual({})
  })

  it('should match constraints on letters that do not fold as written', () => {
    const matcher = createMatcher({ '/x/:id([a-zİ]+)': { prerender: true }, '/y/:id([\u{10400}]+)': { ssr: false }, '/z/:id(\u{10400}+)': { noScripts: true } })
    expect(resolveRouteRules(matcher, '/X/İstanbul', true)).toEqual({ prerender: true })
    expect(resolveRouteRules(matcher, '/y/\u{10400}', true)).toEqual({ ssr: false })
    expect(resolveRouteRules(matcher, '/z/\u{10400}', true)).toEqual({ noScripts: true })
  })
})
