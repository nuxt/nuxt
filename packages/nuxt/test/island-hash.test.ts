import { describe, expect, it } from 'vitest'
import { hash } from 'ohash'
import { computeIslandHash, filterIslandProps, serializeIslandProps } from '#app/island-hash'

describe('filterIslandProps', () => {
  it('returns an empty object for nullish input', () => {
    expect(filterIslandProps(undefined)).toEqual({})
    expect(filterIslandProps(null)).toEqual({})
  })

  it('passes through ordinary props', () => {
    expect(filterIslandProps({ a: 1, b: 'x', c: { nested: true } })).toEqual({
      a: 1,
      b: 'x',
      c: { nested: true },
    })
  })

  it('strips Vue scoped-style markers', () => {
    expect(filterIslandProps({
      'data-v-abc123': '',
      'data-v-def456': '',
      'count': 3,
      'label': 'hi',
    })).toEqual({ count: 3, label: 'hi' })
  })

  it('preserves keys that merely contain "data-v-"', () => {
    // Only the prefix is stripped — keys like `extra-data-v-x` are legitimate.
    expect(filterIslandProps({ 'extra-data-v-x': 1, 'data-v-x': 2 })).toEqual({ 'extra-data-v-x': 1 })
  })
})

describe('serializeIslandProps', () => {
  it('matches the props representation sent over the wire', () => {
    expect(serializeIslandProps({
      'data-v-abc123': '',
      'defined': true,
      'optional': undefined,
      'nested': { optional: undefined },
      'items': [undefined, () => {}],
      'callback': () => {},
    })).toBe('{"defined":true,"nested":{},"items":[null,null]}')
  })

  it('returns `{}` for nullish input', () => {
    expect(serializeIslandProps(undefined)).toBe('{}')
    expect(serializeIslandProps(null)).toBe('{}')
  })

  // #35349
  it('drops function values', () => {
    expect(serializeIslandProps({ heading: () => {}, label: 'hi' })).toBe('{"label":"hi"}')
  })

  // #35349
  it('drops `undefined` values', () => {
    expect(serializeIslandProps({ heading: undefined, label: 'hi' })).toBe('{"label":"hi"}')
  })
})

describe('computeIslandHash', () => {
  it('matches the ohash-based shape the client embeds in the URL', () => {
    const name = 'PureComponent'
    const serializedProps = '{"count":3,"label":"hi"}'
    const context = { url: '/foo' }
    const expected = hash([name, serializedProps, context, undefined]).replace(/[-_]/g, '')
    expect(computeIslandHash(name, serializedProps, context, undefined)).toBe(expected)
  })

  it('changes when props change', () => {
    const a = computeIslandHash('X', '{"n":1}', {}, undefined)
    const b = computeIslandHash('X', '{"n":2}', {}, undefined)
    expect(a).not.toBe(b)
  })

  it('changes when context changes', () => {
    const a = computeIslandHash('X', '{}', { url: '/a' }, undefined)
    const b = computeIslandHash('X', '{}', { url: '/b' }, undefined)
    expect(a).not.toBe(b)
  })

  it('changes when name changes', () => {
    const a = computeIslandHash('A', '{}', {}, undefined)
    const b = computeIslandHash('B', '{}', {}, undefined)
    expect(a).not.toBe(b)
  })

  it('changes when source changes', () => {
    const a = computeIslandHash('X', '{}', {}, undefined)
    const b = computeIslandHash('X', '{}', {}, 'https://remote.example')
    expect(a).not.toBe(b)
  })

  it('produces URL-safe output (no - or _)', () => {
    for (let i = 0; i < 20; i++) {
      const h = computeIslandHash('Comp', JSON.stringify({ i, salt: `${i}-${i}` }), {}, undefined)
      expect(h).not.toMatch(/[-_]/)
    }
  })
})
