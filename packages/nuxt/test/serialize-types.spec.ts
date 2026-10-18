import { describe, expectTypeOf, it } from 'vitest'

import type { Serialize, SerializeObject } from '../src/app/types/serialize'

declare const sym: unique symbol

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

  it('keeps the named keys of a type with an index signature', () => {
    expectTypeOf<Serialize<{ [key: string]: string | number | Date, version: number, at: Date }>>().toEqualTypeOf<{ [key: string]: string | number, version: number, at: string }>()
  })

  it('keeps optional keys optional', () => {
    expectTypeOf<Serialize<{ name?: string, at?: Date }>>().toEqualTypeOf<{ name?: string, at?: string }>()
  })

  it('drops symbol keys', () => {
    expectTypeOf<Serialize<{ [sym]: string, keep: string }>>().toEqualTypeOf<{ keep: string }>()
  })

  it('leaves `any` as `any` rather than collapsing it', () => {
    expectTypeOf<Serialize<any>>().toBeAny()
  })

  it('leaves `unknown` as `unknown` rather than collapsing it', () => {
    expectTypeOf<Serialize<unknown>>().toBeUnknown()
    expectTypeOf<Serialize<{ [key: string]: unknown, version: number }>>().toEqualTypeOf<{ [key: string]: unknown, version: number }>()
    expectTypeOf<Serialize<unknown[]>>().toEqualTypeOf<unknown[]>()
  })

  it('serializes object types directly via `SerializeObject`', () => {
    expectTypeOf<SerializeObject<{ at: Date, fn: () => void }>>().toEqualTypeOf<{ at: string }>()
  })
})
