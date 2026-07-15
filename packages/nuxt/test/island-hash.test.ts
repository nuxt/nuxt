import { describe, expect, it } from 'vitest'
import { hash } from 'ohash'
import { filterIslandProps, getIslandHash, serializeIslandProps } from '#app/island-hash'

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
