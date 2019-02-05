import { getContext, determineGlobals } from '../src/context'

describe('util: context', () => {
  test('should get context with req and res', () => {
    const ctx = getContext({ a: 1 }, { b: 2 })

    expect(getContext.length).toBe(2)
    expect(typeof ctx.req).toBe('object')
    expect(typeof ctx.res).toBe('object')
    expect(ctx.req.a).toBe(1)
    expect(ctx.res.b).toBe(2)
  })

  test('should get correct globals', () => {
    const globals = {
      foo: name => `${name}: foo`,
      bar: name => `${name}: bar`,
      baz: 'baz'
    }
    const result = determineGlobals('global', globals)

    expect(result).toEqual({ bar: 'global: bar', foo: 'global: foo', baz: 'baz' })
  })
})
