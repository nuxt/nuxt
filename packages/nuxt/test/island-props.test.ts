import { describe, expect, it } from 'vitest'

import { findUnsafeIslandPropKey } from '#app/island-props'

describe('findUnsafeIslandPropKey', () => {
  it('flags a template key at the top level', () => {
    expect(findUnsafeIslandPropKey({ template: '<script>alert(1)</script>' })).toBe('template')
  })

  it('flags a template key nested at any depth', () => {
    expect(findUnsafeIslandPropKey({ as: { template: '<x/>' } })).toBe('template')
    expect(findUnsafeIslandPropKey({ a: [{ b: { template: 'x' } }] })).toBe('template')
  })

  it('returns undefined for safe props', () => {
    expect(findUnsafeIslandPropKey({ items: [1, 2, 3], name: 'x' })).toBeUndefined()
    expect(findUnsafeIslandPropKey(null)).toBeUndefined()
    expect(findUnsafeIslandPropKey('template')).toBeUndefined()
  })
})
