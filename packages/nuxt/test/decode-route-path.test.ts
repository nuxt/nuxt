import { describe, expect, it } from 'vitest'

import { decodeRoutePath } from '../src/core/utils/index.ts'

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
})
