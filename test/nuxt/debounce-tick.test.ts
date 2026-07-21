/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { debounceTick } from '#app/utils/debounce-tick'

/** An async function whose promises are resolved manually, in call order. */
function createControllableFn () {
  const resolvers: Array<() => void> = []
  // values in the order their promises settled
  const settled: number[] = []
  const fn = vi.fn((value: number) => new Promise<number>((resolve) => {
    resolvers.push(() => {
      settled.push(value)
      resolve(value)
    })
  }))
  return { fn, settled, resolveNext: () => resolvers.shift()!() }
}

// Adapted from https://github.com/unjs/perfect-debounce/blob/main/test/index.test.ts
// with the wait timeout replaced by the tick boundary (`flushPromises`).
// The `cancel`/`flush`/`isPending` tests do not apply as we do not expose those methods.
describe('debounceTick', () => {
  it('single call', async () => {
    const debounced = debounceTick((value: string) => Promise.resolve(value))
    expect(await debounced('fixture')).toBe('fixture')
  })

  it('multiple calls', async () => {
    const fn = vi.fn((value: number) => Promise.resolve(value))
    const debounced = debounceTick(fn)

    const results = await Promise.all([1, 2, 3, 4, 5].map(value => debounced(value)))

    expect(results).toMatchObject([5, 5, 5, 5, 5])
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(5)

    await flushPromises()
    expect(await debounced(6)).toBe(6)
  })

  it('leading option', async () => {
    const fn = vi.fn((value: number) => Promise.resolve(value))
    const debounced = debounceTick(fn, { leading: true })

    const results = await Promise.all([1, 2, 3, 4].map(value => debounced(value)))

    // value from the first promise is used without waiting for the flush
    expect(results).toEqual([1, 1, 1, 1])
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(1)

    await flushPromises()
    const [five, six] = await Promise.all([debounced(5), debounced(6)])
    expect(five).toBe(5)
    expect(six).toBe(5)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(5)
  })

  it('leading option - does not call input function after flush', async () => {
    const fn = vi.fn(() => Promise.resolve(1))
    const debounced = debounceTick(fn, { leading: true })

    await debounced()
    await flushPromises()

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('fn takes longer than the debounce window', async () => {
    const { fn, resolveNext } = createControllableFn()
    const debounced = debounceTick(fn)

    const promiseSetOne = [1, 2, 3].map(value => debounced(value))
    await flushPromises() // window flushes, fn(3) starts
    const promiseSetTwo = [4, 5, 6].map(value => debounced(value))

    resolveNext() // fn(3) settles, triggering a trailing call with the latest arguments
    await flushPromises()
    resolveNext() // fn(6) settles

    const results = await Promise.all([...promiseSetOne, ...promiseSetTwo])

    expect(results).toMatchObject([3, 3, 3, 3, 3, 3])
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(6)
  })

  it('performs a trailing call when arguments arrive while a leading call is pending', async () => {
    const { fn, resolveNext } = createControllableFn()
    const debounced = debounceTick(fn, { leading: true })

    debounced(1)
    expect(fn).toHaveBeenCalledTimes(1)

    // wait for the post-flush callback so the debounce window closes
    await flushPromises()

    // call while the first invocation is still pending
    debounced(2)
    expect(fn).toHaveBeenCalledTimes(1)

    resolveNext()
    await flushPromises()

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(2)
  })

  it('`this` is preserved', async () => {
    class Fixture {
      _foo = 'fixture'

      foo () {
        // If `this` is not preserved by `debounceTick()`, then `this` will be
        // undefined and accessing `this._foo` will throw.
        return this._foo
      }

      getThis () {
        return this
      }
    }
    Fixture.prototype.foo = debounceTick(Fixture.prototype.foo) as unknown as Fixture['foo']
    Fixture.prototype.getThis = debounceTick(Fixture.prototype.getThis) as unknown as Fixture['getThis']

    const thisFixture = new Fixture()

    expect(await thisFixture.getThis()).toBe(thisFixture)
    expect(() => thisFixture.foo()).not.toThrow()
    expect(await thisFixture.foo()).toBe('fixture')
  })

  it('wait for promise', async () => {
    /*
    Calls:     C(1)        C(2)  C(3)        C(4)  C(5)        C(6)
    Promise:         [        (1)      ][       (3)      ][       (5)      ][ (6) ]
    Trailing:              T=2   T=3         T=4   T=5          T=6
    Resolves:  R=1         R=1   R=1         R=3   R=3          R=5
    */
    const { fn, settled, resolveNext } = createControllableFn()
    const debounced = debounceTick(fn)

    const promises: Array<Promise<number>> = []

    promises.push(debounced(1))
    await flushPromises() // window flushes, fn(1) starts
    promises.push(debounced(2), debounced(3))
    resolveNext() // fn(1) settles, triggering a trailing fn(3)
    await flushPromises()
    promises.push(debounced(4), debounced(5))
    resolveNext() // fn(3) settles, triggering a trailing fn(5)
    await flushPromises()
    promises.push(debounced(6))
    resolveNext() // fn(5) settles, triggering a trailing fn(6)
    await flushPromises()
    resolveNext() // fn(6) settles

    const resolvedResults = await Promise.all(promises)

    expect(settled).toMatchObject([1, 3, 5, 6])
    expect(resolvedResults).toMatchObject([1, 1, 1, 3, 3, 5])
  })

  it('wait for promise (leading: true)', async () => {
    /*
    Calls:     C(1)        C(2)        C(3)  C(4)        C(5)  C(6)
    Promise:   [        (1)      ][       (2)      ][       (4)      ][ (6) ]
    Trailing:              T=2         T=3   T=4         T=5   T=6
    Resolves:  R=1         R=1         R=2   R=2         R=4   R=4
    */
    const { fn, settled, resolveNext } = createControllableFn()
    const debounced = debounceTick(fn, { leading: true })

    const promises: Array<Promise<number>> = []

    promises.push(debounced(1)) // leading call, fn(1) starts immediately
    await flushPromises() // window flushes while fn(1) is still pending
    promises.push(debounced(2))
    resolveNext() // fn(1) settles, triggering a trailing fn(2)
    await flushPromises()
    promises.push(debounced(3), debounced(4))
    resolveNext() // fn(2) settles, triggering a trailing fn(4)
    await flushPromises()
    promises.push(debounced(5), debounced(6))
    resolveNext() // fn(4) settles, triggering a trailing fn(6)
    await flushPromises()
    resolveNext() // fn(6) settles

    const resolvedResults = await Promise.all(promises)

    expect(settled).toMatchObject([1, 2, 4, 6])
    expect(resolvedResults).toMatchObject([1, 1, 2, 2, 4, 4])
  })
})
