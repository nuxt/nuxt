import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { decodeRoutePath, foldRouteCase, resolveRoutePathDotSegments } from '../src/core/utils/index.ts'
import { findCaseDependentConstraint, findCaseDependentRouteRuleKeyPart, normalizeRouteRuleKey, normalizeRouteRulePath } from '../src/core/utils/route-rules.ts'

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

describe('foldRouteCase', () => {
  const unit = (code: number) => String.fromCharCode(code)
  const equalIgnoringCase = (a: string, b: string) => new RegExp(`^\\u${a.charCodeAt(0).toString(16).padStart(4, '0')}$`, 'i').test(b)

  it('should fold two code units together exactly when a case-insensitive regex treats them as equal', () => {
    for (let code = 0; code <= 0xFFFF; code++) {
      const char = unit(code)
      const folded = foldRouteCase(char)
      expect(folded.length, char).toBe(1)
      expect(equalIgnoringCase(char, folded), char).toBe(true)
      for (const other of [char.toUpperCase(), char.toLowerCase()]) {
        if (other.length !== 1) { continue }
        expect(foldRouteCase(other) === folded, `${char} / ${other}`).toBe(equalIgnoringCase(char, other))
      }
    }
  })

  it('should fold letters the way vue-router compares them', () => {
    expect(foldRouteCase('/ΣΊΓΜΑ/ςίγμα')).toBe('/σίγμα/σίγμα')
    expect(foldRouteCase('/µ/ᲂкно/ABC')).toBe('/μ/окно/abc')
    expect(foldRouteCase('/İ/\u212A/ẞ/ß/\u{10400}')).toBe('/İ/\u212A/ẞ/ß/\u{10400}')
  })
})

describe('resolveRoutePathDotSegments', () => {
  it('resolves dot segments', () => {
    expect(resolveRoutePathDotSegments('/./dashboard')).toBe('/dashboard')
    expect(resolveRoutePathDotSegments('/x/../dashboard')).toBe('/dashboard')
    expect(resolveRoutePathDotSegments('/a/b/../../dashboard')).toBe('/dashboard')
    expect(resolveRoutePathDotSegments('/../../dashboard')).toBe('/dashboard')
    expect(resolveRoutePathDotSegments('/a//../dashboard')).toBe('/a/dashboard')
  })

  it('resolves a trailing dot segment to a trailing slash', () => {
    expect(resolveRoutePathDotSegments('/dashboard/.')).toBe('/dashboard/')
    expect(resolveRoutePathDotSegments('/dashboard/x/..')).toBe('/dashboard/')
    expect(resolveRoutePathDotSegments('/..')).toBe('/')
  })

  it('resolves percent-encoded dot segments', () => {
    expect(resolveRoutePathDotSegments('/%2e/dashboard')).toBe('/dashboard')
    expect(resolveRoutePathDotSegments('/x/%2E%2e/dashboard')).toBe('/dashboard')
    expect(resolveRoutePathDotSegments('/x/.%2e/dashboard')).toBe('/dashboard')
    expect(resolveRoutePathDotSegments('/x/%2e./dashboard')).toBe('/dashboard')
  })

  it('leaves other segments containing dots untouched', () => {
    expect(resolveRoutePathDotSegments('/.well-known/x')).toBe('/.well-known/x')
    expect(resolveRoutePathDotSegments('/x/.../y')).toBe('/x/.../y')
    expect(resolveRoutePathDotSegments('/x/%252e%252e/y')).toBe('/x/%252e%252e/y')
    expect(resolveRoutePathDotSegments('/x/..%2Fy')).toBe('/x/..%2Fy')
    expect(resolveRoutePathDotSegments('/sitemap.xml')).toBe('/sitemap.xml')
  })

  it('resolves only the path portion of a query-bearing path', () => {
    expect(resolveRoutePathDotSegments('/./old?next=/../x')).toBe('/old?next=/../x')
  })

  it('should resolve paths as a URL parser does', () => {
    const segment = fc.oneof(pathSegment.map(segment => segment.replace(/[\0-\x20\x7F%/?#\\]/g, '')), fc.constantFrom('.', '..', '%2e', '%2E', '.%2e', '%2e%2e', ''))
    fc.assert(fc.property(fc.array(segment, { minLength: 1, maxLength: 5 }), (segments) => {
      const path = '/' + segments.join('/')
      const resolved = resolveRoutePathDotSegments(path)
      expect(new URL('http://localhost' + resolved).pathname).toBe(new URL('http://localhost' + path).pathname)
      expect(resolved.split('/').some(s => /^(?:\.|%2e){1,2}$/i.test(s))).toBe(false)
    }), { numRuns: 1000 })
  })
})

describe('normalizeRouteRulePath', () => {
  it('should resolve dot segments before decoding', () => {
    expect(normalizeRouteRulePath('/./Dashboard', true)).toBe('/dashboard')
    expect(normalizeRouteRulePath('/x/%2e%2e/dashboard', false)).toBe('/dashboard')
    expect(normalizeRouteRulePath('/x/%252e%252e/dashboard', false)).toBe('/x/%2e%2e/dashboard')
  })

  it('should fold by case-folding the unfolded key', () => {
    fc.assert(fc.property(routePath, (path) => {
      expect(normalizeRouteRulePath(path, true)).toBe(foldRouteCase(normalizeRouteRulePath(path, false)))
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
  it('should fold literal text but not regex constraints', () => {
    expect(normalizeRouteRuleKey('/X/:id(\\D+)', true)).toBe('/x/:id(\\D+)')
    expect(normalizeRouteRuleKey('/X/:id(\\W|\\S|\\B)/Y', true)).toBe('/x/:id(\\W|\\S|\\B)/y')
    expect(normalizeRouteRuleKey('/X/:id([A-z]+)', true)).toBe('/x/:id([A-z]+)')
    expect(normalizeRouteRuleKey('/:a(\\P{Lu}+)-:b([A-Z](?:\\D))', true)).toBe('/:a(\\P{Lu}+)-:b([A-Z](?:\\D))')
    expect(normalizeRouteRuleKey('/:role(Admin|User)', true)).toBe('/:role(Admin|User)')
    expect(normalizeRouteRuleKey('/X/:id([A-Z]\\D+)', false)).toBe('/X/:id([A-Z]\\D+)')
  })

  it('should treat escaped and bracketed parentheses as part of their group', () => {
    expect(normalizeRouteRuleKey('/A\\(B/:id([)]A)C', true)).toBe('/a\\(b/:id([)]A)c')
    expect(normalizeRouteRuleKey('/A/:id(\\)A)B', true)).toBe('/a/:id(\\)A)b')
    expect(normalizeRouteRuleKey('/A/:id(\\D', true)).toBe('/a/:id(\\D')
  })

  it('should decode constraints and literals', () => {
    expect(normalizeRouteRuleKey('/Caf%C3%89/:id(caf%C3%A9|CAF%C3%89)', true)).toBe('/café/:id(café|CAFÉ)')
    expect(normalizeRouteRuleKey('/Caf%C3%89/:id(caf%C3%A9|CAF%C3%89)', false)).toBe('/CafÉ/:id(café|CAFÉ)')
  })

  it('should decode percent-encoded regex syntax in constraints to a literal match', () => {
    expect(normalizeRouteRuleKey('/:id(a%5Cd%2E%5B%2D%5D)', true)).toBe('/:id(a\\\\d\\.\\[\\-\\])')
    expect(normalizeRouteRuleKey('/:id(a%2Fb%3Fc)', false)).toBe('/:id(a%2Fb%3Fc)')
    expect(normalizeRouteRuleKey('/:id(100%)', true)).toBe('/:id(100%)')
  })
})

describe('findCaseDependentRouteRuleKeyPart', () => {
  it('finds the case-dependent part in any constraint of a key', () => {
    expect(findCaseDependentRouteRuleKeyPart('/X/:id([a-z]+)/:rest((?:FOO|bar))')).toBe('F')
    expect(findCaseDependentRouteRuleKeyPart('/X/:id([A-z]+)/Y')).toBeUndefined()
  })

  it('checks percent-encoded characters in a constraint as the matcher decodes them', () => {
    expect(findCaseDependentRouteRuleKeyPart('/X/:id([%41-%5A]+)')).toBe('[A-Z]')
    expect(findCaseDependentRouteRuleKeyPart('/X/:id([%41]+)')).toBe('[A]')
    expect(findCaseDependentRouteRuleKeyPart('/X/:id([%61-%7A%5F]+)')).toBeUndefined()
  })
})

describe('findCaseDependentConstraint', () => {
  it('accepts constraints that match a lower-cased path the way they read', () => {
    for (const constraint of ['([a-z]+)', '([A-z]+)', '([!-~]+)', '([0-9a-zA-Z_]+)', '(\\D+)', '(\\w+)', '(\\W\\S\\B\\b\\d\\s)', '((?:foo|bar))', '(caf%C3%A9)', '(café)', '(\\x61\\x31)', '([^a-zA-Z])', '(\\1)', '(.{2,3})']) {
      expect(findCaseDependentConstraint(constraint), constraint).toBeUndefined()
    }
  })

  it('finds the part of a constraint that depends on letter case', () => {
    expect(findCaseDependentConstraint('(A)')).toBe('A')
    expect(findCaseDependentConstraint('([A-Z]+)')).toBe('[A-Z]')
    expect(findCaseDependentConstraint('((?:FOO))')).toBe('F')
    expect(findCaseDependentConstraint('((?:foo|BAR))')).toBe('B')
    expect(findCaseDependentConstraint('([!-a]+)')).toBe('[!-a]')
    expect(findCaseDependentConstraint('([^a-z])')).toBe('[^a-z]')
    expect(findCaseDependentConstraint('([^A-Z])')).toBe('[^A-Z]')
    expect(findCaseDependentConstraint('(\\x41+)')).toBe('\\x41')
    expect(findCaseDependentConstraint('(\\u00C9)')).toBe('\\u00C9')
    expect(findCaseDependentConstraint('(\\101)')).toBe('\\101')
    expect(findCaseDependentConstraint('(\\cA)')).toBeUndefined()
    expect(findCaseDependentConstraint('(caf%C3%89)')).toBe('%C3%89')
    expect(findCaseDependentConstraint('(cafÉ)')).toBe('É')
    expect(findCaseDependentConstraint('(\\p{Lu})')).toBe('L')
  })

  it('checks constraints against the case folding vue-router uses', () => {
    for (const constraint of ['([a-zçğıöşüİ]+)', '([\\u0130]+)', '(\\u212A)', '([\u{10400}]+)', '(\u{10400}+)', '([a-zσς]+)', '([^a-zA-Z]+)', '(\\W+)', '([^/]+)']) {
      expect(findCaseDependentConstraint(constraint), constraint).toBeUndefined()
    }
    expect(findCaseDependentConstraint('([a-zς]+)')).toBe('[a-zς]')
    expect(findCaseDependentConstraint('(ς)')).toBe('ς')
    expect(findCaseDependentConstraint('(µ)')).toBe('µ')
    expect(findCaseDependentConstraint('(ᲂ)')).toBe('ᲂ')
  })
})
