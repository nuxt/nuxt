import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { decodeRoutePath } from '../src/core/utils/index.ts'
import { normalizeRouteRulePath } from '../src/core/utils/route-rules.ts'

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
