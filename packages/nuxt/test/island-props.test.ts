import { describe, expect, it } from 'vitest'

import { findReservedRootIslandPropKey, findUnsafeIslandPropKey } from '#app/island-props'

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

describe('findReservedRootIslandPropKey', () => {
  const undeclared = {}

  it('flags a top-level `as` prop the island does not declare', () => {
    expect(findReservedRootIslandPropKey({ as: 'iframe' }, undeclared)).toBe('as')
    expect(findReservedRootIslandPropKey({ as: 'iframe' }, { props: { other: String } })).toBe('as')
    expect(findReservedRootIslandPropKey({ as: 'iframe' }, { props: ['other'] })).toBe('as')
  })

  it('allows `as` when the island declares it', () => {
    expect(findReservedRootIslandPropKey({ as: 'iframe' }, { props: { as: String } })).toBeUndefined()
    expect(findReservedRootIslandPropKey({ as: 'iframe' }, { props: ['as'] })).toBeUndefined()
  })

  it('allows `as` when the island opts out of attribute inheritance', () => {
    expect(findReservedRootIslandPropKey({ as: 'iframe' }, { inheritAttrs: false })).toBeUndefined()
  })

  it('does not flag a nested `as` key (author must opt in to forwarding)', () => {
    expect(findReservedRootIslandPropKey({ props: { as: 'iframe' } }, undeclared)).toBeUndefined()
  })

  it('returns undefined for safe props and non-objects', () => {
    expect(findReservedRootIslandPropKey({ items: [1, 2, 3] }, undeclared)).toBeUndefined()
    expect(findReservedRootIslandPropKey(['as'], undeclared)).toBeUndefined()
    expect(findReservedRootIslandPropKey(null, undeclared)).toBeUndefined()
  })
})
