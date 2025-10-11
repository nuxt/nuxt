import { describe, expectTypeOf, it } from 'vitest'
import { defineKeyedFunctionFactory } from '#imports'

describe('compiler:defineKeyedFunctionFactory', () => {
  it('preserves parameter and return types', () => {
    type Args = [id: string, label: string, options?: { silent?: boolean }]
    type Ret = { id: number, label: string, ok: true }

    const fn = (...args: Args): Ret => {
      return undefined as unknown as Ret
    }

    const factory = defineKeyedFunctionFactory({
      name: 'createUseFetch',
      factory: fn,
    })

    // callable type
    expectTypeOf(factory).not.toBeAny()
    expectTypeOf(factory).toEqualTypeOf<typeof fn>()
    expectTypeOf(factory).parameters.toEqualTypeOf<Args>()
    expectTypeOf(factory).returns.toEqualTypeOf<Ret>()
  })

  it('works with generics in the real factory', () => {
    const fn = <T extends { id: string }>(entity: T, flag: boolean) => {
      return { entity, flag, kind: 'ok' as const }
    }

    const generic = defineKeyedFunctionFactory({
      name: 'createGeneric',
      factory: fn,
    })

    // check that generics are preserved on call signature
    expectTypeOf(generic).toBeCallableWith({ id: 'x' }, true)

    // parameter and return types stay generic
    expectTypeOf(generic).parameter(0).toEqualTypeOf<{ id: string }>()
    expectTypeOf(generic<{ id: 'a' }>({ id: 'a' }, true)).toMatchObjectType<{ entity: { id: 'a' }, flag: boolean, kind: 'ok' }>()
  })
})
