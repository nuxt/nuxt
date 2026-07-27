import { describe, expect, it } from 'vitest'
import { hash } from 'ohash'
import { filterIslandProps, getIslandHash, serializeIslandProps } from '#app/island-hash'
import { findReservedRootIslandPropKey, findUnsafeIslandPropKey } from '#app/island-props'

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

describe('getIslandHash', () => {
  it('matches the ohash-based shape the client embeds in the URL', () => {
    const name = 'PureComponent'
    const serializedProps = '{"count":3,"label":"hi"}'
    const context = { url: '/foo' }
    const expected = hash([name, JSON.parse(serializedProps), context, undefined]).replace(/[-_]/g, '')
    expect(getIslandHash({ name, props: serializedProps, context })).toBe(expected)
  })

  // External island clients (e.g. `@nuxtjs/og-image`) hash the plain props object and send
  // `JSON.stringify(props)`; that hash must still validate when the round-trip is identity.
  it('matches a client that hashes the props object directly', () => {
    const name = 'OgImageCommunityNuxtSeoSatori'
    const props = { title: 'Hello World' }
    const objectHash = hash([name, props, {}, undefined]).replace(/[-_]/g, '')
    expect(getIslandHash({ name, props: JSON.stringify(props) })).toBe(objectHash)
  })

  it('agrees whether props are passed as an object or as the serialized string', () => {
    const props = { title: 'Hello World', count: 3 }
    expect(getIslandHash({ name: 'X', props })).toBe(getIslandHash({ name: 'X', props: JSON.stringify(props) }))
  })

  // #35349
  it('is stable across the JSON round-trip for dropped values', () => {
    const serialized = serializeIslandProps({ label: 'hi', onClick: () => {}, missing: undefined })
    const objectHash = hash(['X', { label: 'hi' }, {}, undefined]).replace(/[-_]/g, '')
    expect(getIslandHash({ name: 'X', props: serialized })).toBe(objectHash)
  })

  // The server hashes attacker-controllable query input before validating it.
  it('does not throw on malformed serialized props', () => {
    expect(() => getIslandHash({ name: 'X', props: '{"a":1' })).not.toThrow()
  })

  it('changes when props change', () => {
    const a = getIslandHash({ name: 'X', props: '{"n":1}' })
    const b = getIslandHash({ name: 'X', props: '{"n":2}' })
    expect(a).not.toBe(b)
  })

  it('changes when context changes', () => {
    const a = getIslandHash({ name: 'X', props: '{}', context: { url: '/a' } })
    const b = getIslandHash({ name: 'X', props: '{}', context: { url: '/b' } })
    expect(a).not.toBe(b)
  })

  it('changes when name changes', () => {
    const a = getIslandHash({ name: 'A', props: '{}' })
    const b = getIslandHash({ name: 'B', props: '{}' })
    expect(a).not.toBe(b)
  })

  it('changes when source changes', () => {
    const a = getIslandHash({ name: 'X', props: '{}' })
    const b = getIslandHash({ name: 'X', props: '{}', source: 'https://remote.example' })
    expect(a).not.toBe(b)
  })

  it('produces URL-safe output (no - or _)', () => {
    for (let i = 0; i < 20; i++) {
      const h = getIslandHash({ name: 'Comp', props: JSON.stringify({ i, salt: `${i}-${i}` }) })
      expect(h).not.toMatch(/[-_]/)
    }
  })
})

describe('findUnsafeIslandPropKey', () => {
  it('returns undefined for null and undefined', () => {
    expect(findUnsafeIslandPropKey(null)).toBeUndefined()
    expect(findUnsafeIslandPropKey(undefined)).toBeUndefined()
  })

  it('returns undefined for primitives', () => {
    expect(findUnsafeIslandPropKey(42)).toBeUndefined()
    expect(findUnsafeIslandPropKey('hello')).toBeUndefined()
    expect(findUnsafeIslandPropKey(true)).toBeUndefined()
  })

  it('returns undefined for plain objects without a template key', () => {
    expect(findUnsafeIslandPropKey({ foo: 1, bar: 'baz' })).toBeUndefined()
    expect(findUnsafeIslandPropKey({ content: { title: 'Hello' }, items: [{ label: 'One' }] })).toBeUndefined()
  })

  it('returns undefined for arrays without a template key', () => {
    expect(findUnsafeIslandPropKey([1, 2, 3])).toBeUndefined()
    expect(findUnsafeIslandPropKey([{ ok: true }])).toBeUndefined()
  })

  it('returns the template key at the top level', () => {
    expect(findUnsafeIslandPropKey({ template: '<div>evil</div>' })).toBe('template')
  })

  it('returns the template key when nested in an object', () => {
    expect(findUnsafeIslandPropKey({ as: { template: '<div />' } })).toBe('template')
  })

  it('returns the template key when nested in an array', () => {
    expect(findUnsafeIslandPropKey({ items: [{ id: 1 }, { template: 'evil' }] })).toBe('template')
  })

  it('does not match keys that merely contain template as a substring', () => {
    expect(findUnsafeIslandPropKey({ template_id: 42, pretemplate: true })).toBeUndefined()
  })

  it('only considers own enumerable properties', () => {
    const inherited = Object.create({ template: '<div />' })
    inherited.label = 'safe'
    expect(findUnsafeIslandPropKey({ inherited })).toBeUndefined()
  })

  it('handles circular values without infinite loop', () => {
    const value: Record<string, unknown> = {}
    value.self = value
    expect(findUnsafeIslandPropKey(value)).toBeUndefined()
  })
})

describe('findReservedRootIslandPropKey', () => {
  const undeclared = {}

  it('returns undefined for nullish, primitives, and arrays', () => {
    expect(findReservedRootIslandPropKey(null, undeclared)).toBeUndefined()
    expect(findReservedRootIslandPropKey(undefined, undeclared)).toBeUndefined()
    expect(findReservedRootIslandPropKey('as', undeclared)).toBeUndefined()
    expect(findReservedRootIslandPropKey([{ as: 'iframe' }], undeclared)).toBeUndefined()
  })

  it('returns the reserved key when the island does not declare `as`', () => {
    expect(findReservedRootIslandPropKey({ as: 'iframe' }, undeclared)).toBe('as')
    expect(findReservedRootIslandPropKey({ as: { some: 'object' }, other: 1 }, undeclared)).toBe('as')
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

  it('ignores `as` nested below the top level', () => {
    expect(findReservedRootIslandPropKey({ user: { as: 'iframe' } }, undeclared)).toBeUndefined()
    expect(findReservedRootIslandPropKey({ items: [{ as: 'iframe' }] }, undeclared)).toBeUndefined()
  })

  it('does not match keys that merely contain `as`', () => {
    expect(findReservedRootIslandPropKey({ aside: 1, hasChildren: true, canvas: 'x' }, undeclared)).toBeUndefined()
  })
})
