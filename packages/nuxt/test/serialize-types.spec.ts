import { describe, expectTypeOf, it } from 'vitest'

import type { Serialize, SerializeObject } from '../src/app/types/serialize'

describe('Serialize', () => {
  it('passes JSON primitives through unchanged', () => {
    expectTypeOf<Serialize<string>>().toEqualTypeOf<string>()
    expectTypeOf<Serialize<number>>().toEqualTypeOf<number>()
    expectTypeOf<Serialize<boolean>>().toEqualTypeOf<boolean>()
    expectTypeOf<Serialize<null>>().toEqualTypeOf<null>()
    expectTypeOf<Serialize<undefined>>().toEqualTypeOf<undefined>()
    expectTypeOf<Serialize<'literal'>>().toEqualTypeOf<'literal'>()
  })

  it('drops object keys JSON cannot represent', () => {
    expectTypeOf<Serialize<{ keep: string, fn: () => void, undef: undefined, sym: symbol }>>().toEqualTypeOf<{ keep: string }>()
  })

  it('nulls array and tuple entries JSON cannot represent', () => {
    expectTypeOf<Serialize<Array<string | undefined>>>().toEqualTypeOf<Array<string | null>>()
    expectTypeOf<Serialize<[string, () => void]>>().toEqualTypeOf<[string, null]>()
    expectTypeOf<Serialize<[]>>().toEqualTypeOf<[]>()
  })

  it('resolves values through `toJSON`', () => {
    expectTypeOf<Serialize<Date>>().toEqualTypeOf<string>()
    expectTypeOf<Serialize<{ at: Date }>>().toEqualTypeOf<{ at: string }>()
  })

  it('empties collections JSON cannot represent', () => {
    expectTypeOf<Serialize<Map<string, number>>>().toEqualTypeOf<Record<string, never>>()
    expectTypeOf<Serialize<Set<string>>>().toEqualTypeOf<Record<string, never>>()
  })

  it('recurses into nested objects and arrays', () => {
    expectTypeOf<Serialize<{ nested: { at: Date, fn: () => void }, list: Date[] }>>().toEqualTypeOf<{ nested: { at: string }, list: string[] }>()
  })

  it('distributes over unions', () => {
    expectTypeOf<Serialize<{ type: 'a', at: Date } | { type: 'b', fn: () => void }>>().toEqualTypeOf<{ type: 'a', at: string } | { type: 'b' }>()
  })

  it('leaves `any` as `any` rather than collapsing it', () => {
    expectTypeOf<Serialize<any>>().toBeAny()
  })

  it('serializes object types directly via `SerializeObject`', () => {
    expectTypeOf<SerializeObject<{ at: Date, fn: () => void }>>().toEqualTypeOf<{ at: string }>()
  })
})
