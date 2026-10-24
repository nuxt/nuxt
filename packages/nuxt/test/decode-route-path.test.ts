import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { decodeRoutePath } from '../src/core/utils/index.ts'
import { normalizeRouteRuleKey, normalizeRouteRulePath } from '../src/core/utils/route-rules.ts'

const RESERVED_RE = /[%;/?:@&=+$,#]/g

const pathSegment = fc.oneof(
  fc.string(),
  fc.string({ unit: 'grapheme' }),
  fc.constantFrom('a', 'A', 'Ünicode', '测试', 'cafÉ', '100% legit', '%', '%2F', '%25', '%2525', '%C3', '+', ' ', 'a?b', 'a#b'),
)
const routePath = fc.array(pathSegment, { minLength: 1, maxLength: 3 }).map(segments => '/' + segments.join('/'))

describe('decodeRoutePath', () => {
  it('decodes percent-encoded paths', () => {
    expect(decodeRoutePath('/pre/t%65st')).toBe('/pre/test')
    expect(decodeRoutePath('/%E6%B5%8B%E8%AF%95')).toBe('/测试')
  })

  it('decodes double-encoded sequences only once', () => {
    expect(decodeRoutePath('/pre/%2574est')).toBe('/pre/%74est')
  })

  it('leaves reserved characters encoded', () => {
    expect(decodeRoutePath('/pre%2Ftest')).toBe('/pre%2Ftest')
    expect(decodeRoutePath('/pre%3Ftest')).toBe('/pre%3Ftest')
  })

  it('returns unchanged paths that are not percent-encoded or cannot be decoded', () => {
    expect(decodeRoutePath('/pre/test')).toBe('/pre/test')
    expect(decodeRoutePath('/100% legit')).toBe('/100% legit')
    expect(decodeRoutePath('/caf%C3')).toBe('/caf%C3')
  })

  it('decodes only the path portion of a query-bearing path', () => {
    expect(decodeRoutePath('/pre/t%65st?next=%252Fhome')).toBe('/pre/test?next=%252Fhome')
    expect(decodeRoutePath('/pre/test?next=%41')).toBe('/pre/test?next=%41')
  })

  it('should never change the number of path segments', () => {
    fc.assert(fc.property(routePath, (path) => {
      expect(decodeRoutePath(path).split('/').length).toBe(path.split('/').length)
    }), { numRuns: 1000 })
  })

  it('should never introduce a query delimiter', () => {
    fc.assert(fc.property(routePath, (path) => {
      fc.pre(!path.includes('?'))
      expect(decodeRoutePath(path)).not.toContain('?')
    }), { numRuns: 1000 })
  })

  it('should leave every reserved character encoded', () => {
    fc.assert(fc.property(fc.constantFrom(...';/?:@&=+$,#'), (char) => {
      const path = '/x' + encodeURIComponent(char) + 'y'
      expect(decodeRoutePath(path)).toBe(path)
    }))
  })
})

describe('normalizeRouteRulePath', () => {
  it('should fold by lowercasing the unfolded key', () => {
    fc.assert(fc.property(routePath, (path) => {
      expect(normalizeRouteRulePath(path, true)).toBe(normalizeRouteRulePath(path, false).toLowerCase())
    }), { numRuns: 1000 })
  })

  it('should normalize an encoded request path onto its decoded rule key', () => {
    const unreservedSegment = pathSegment.map(segment => segment.replace(RESERVED_RE, ''))
    fc.assert(fc.property(fc.array(unreservedSegment, { minLength: 1, maxLength: 3 }), fc.boolean(), (segments, fold) => {
      const decoded = '/' + segments.join('/')
      const encoded = '/' + segments.map(segment => encodeURIComponent(segment)).join('/')
      expect(normalizeRouteRulePath(encoded, fold)).toBe(normalizeRouteRulePath(decoded, fold))
    }), { numRuns: 1000 })
  })
})

describe('normalizeRouteRuleKey', () => {
  it('should fold regex constraints but not their escape sequences', () => {
    expect(normalizeRouteRuleKey('/X/:id(\\D+)', true)).toBe('/x/:id(\\D+)')
    expect(normalizeRouteRuleKey('/X/:id(\\W|\\S|\\B)/Y', true)).toBe('/x/:id(\\W|\\S|\\B)/y')
    expect(normalizeRouteRuleKey('/:a(\\P{Lu}+)-:b([A-Z](?:\\D))', true)).toBe('/:a(\\P{Lu}+)-:b([a-z](?:\\D))')
    expect(normalizeRouteRuleKey('/:role(Admin|User)', true)).toBe('/:role(admin|user)')
    expect(normalizeRouteRuleKey('/X/:id([A-Z]\\D+)', false)).toBe('/X/:id([A-Z]\\D+)')
  })

  it('should treat escaped and bracketed parentheses as part of their group', () => {
    expect(normalizeRouteRuleKey('/A\\(B/:id([)]A)C', true)).toBe('/a\\(b/:id([)]a)c')
    expect(normalizeRouteRuleKey('/A/:id(\\)A)B', true)).toBe('/a/:id(\\)a)b')
    expect(normalizeRouteRuleKey('/A/:id(\\D', true)).toBe('/a/:id(\\D')
  })

  it('should decode constraints and literals', () => {
    expect(normalizeRouteRuleKey('/Caf%C3%89/:id(caf%C3%A9|CAF%C3%89)', true)).toBe('/café/:id(café|café)')
    expect(normalizeRouteRuleKey('/Caf%C3%89/:id(caf%C3%A9|CAF%C3%89)', false)).toBe('/CafÉ/:id(café|CAFÉ)')
  })

  it('should decode percent-encoded regex syntax in constraints to a literal match', () => {
    expect(normalizeRouteRuleKey('/:id(a%5Cd%2E%5B%2D%5D)', true)).toBe('/:id(a\\\\d\\.\\[\\-\\])')
    expect(normalizeRouteRuleKey('/:id(a%2Fb%3Fc)', false)).toBe('/:id(a%2Fb%3Fc)')
    expect(normalizeRouteRuleKey('/:id(100%)', true)).toBe('/:id(100%)')
  })
})
