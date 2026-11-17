import { describe, expect, it, vi } from 'vitest'

import type { Nuxt } from '@nuxt/schema'
import { runWithNuxtContext, tryUseNuxt } from '@nuxt/kit'

describe('asyncNuxtStorage', () => {
  it('should return nuxt instance', () => {
    const nuxt = { __name: '1' } as Nuxt
    expect(tryUseNuxt()?.__name).toBeUndefined()
    expect(runWithNuxtContext(nuxt, () => tryUseNuxt()?.__name)).toBe('1')
  })

  it('should isolate async ctx', async () => {
    const nuxt1 = { __name: '1' } as Nuxt
    const nuxt2 = { __name: '2' } as Nuxt
    const nuxt3 = { __name: '3' } as Nuxt

    let resolve!: () => void
    const promise = new Promise<void>(resolve_ => resolve = resolve_)

    expect(tryUseNuxt()?.__name).toBeUndefined()

    await expect(Promise.all([
      runWithNuxtContext(nuxt1, async () => {
        await promise
        return tryUseNuxt()?.__name
      }),
      runWithNuxtContext(nuxt2, async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        resolve()
        return tryUseNuxt()?.__name
      }),
      runWithNuxtContext(nuxt3, async () => {
        await promise
        return tryUseNuxt()?.__name
      }),
    ])).resolves.toEqual(['1', '2', '3'])

    expect(tryUseNuxt()?.__name).toBeUndefined()
  })

  it('should share ctx with same kit', async () => {
    const sameKit = await import('@nuxt/kit')

    expect(sameKit.tryUseNuxt).toBe(tryUseNuxt)

    const nuxt = { __name: '1' } as Nuxt

    expect(tryUseNuxt()?.__name).toBeUndefined()
    expect(sameKit.tryUseNuxt()?.__name).toBeUndefined()

    expect(runWithNuxtContext(nuxt, () => tryUseNuxt()?.__name)).toBe('1')
    expect(runWithNuxtContext(nuxt, () => sameKit.tryUseNuxt()?.__name)).toBe('1')

    expect(tryUseNuxt()?.__name).toBeUndefined()
    expect(sameKit.tryUseNuxt()?.__name).toBeUndefined()
  })

  it('should share ctx with another kit', async () => {
    vi.resetModules()
    const anotherKit = await import('@nuxt/kit')

    expect(anotherKit.tryUseNuxt).not.toBe(tryUseNuxt)

    const nuxt = { __name: '1' } as Nuxt

    expect(tryUseNuxt()?.__name).toBeUndefined()
    expect(anotherKit.tryUseNuxt()?.__name).toBeUndefined()

    expect(runWithNuxtContext(nuxt, () => tryUseNuxt()?.__name)).toBe('1')
    expect(runWithNuxtContext(nuxt, () => anotherKit.tryUseNuxt()?.__name)).toBe('1')

    expect(tryUseNuxt()?.__name).toBeUndefined()
    expect(anotherKit.tryUseNuxt()?.__name).toBeUndefined()
  })

  it('should isolate ctx with another kit', async () => {
    vi.resetModules()
    const anotherKit = await import('@nuxt/kit')

    expect(anotherKit.tryUseNuxt).not.toBe(tryUseNuxt)

    const nuxt1 = { __name: '1' } as Nuxt
    const nuxt2 = { __name: '2' } as Nuxt

    expect(anotherKit.tryUseNuxt()?.__name).toBeUndefined()

    expect(runWithNuxtContext(nuxt1, () => anotherKit.tryUseNuxt()?.__name)).toBe('1')
    expect(runWithNuxtContext(nuxt2, () => anotherKit.tryUseNuxt()?.__name)).toBe('2')

    expect(anotherKit.tryUseNuxt()?.__name).toBeUndefined()
  })

  it('should isolate async ctx with another kit', async () => {
    vi.resetModules()
    const anotherKit = await import('@nuxt/kit')

    expect(anotherKit.tryUseNuxt).not.toBe(tryUseNuxt)

    const nuxt1 = { __name: '1' } as Nuxt
    const nuxt2 = { __name: '2' } as Nuxt
    const nuxt3 = { __name: '3' } as Nuxt

    let resolve!: () => void
    const promise = new Promise<void>(resolve_ => resolve = resolve_)

    expect(tryUseNuxt()?.__name).toBeUndefined()
    expect(anotherKit.tryUseNuxt()?.__name).toBeUndefined()

    await expect(Promise.all([
      runWithNuxtContext(nuxt1, async () => {
        await promise
        return anotherKit.tryUseNuxt()?.__name
      }),
      runWithNuxtContext(nuxt2, async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        resolve()
        return anotherKit.tryUseNuxt()?.__name
      }),
      anotherKit.runWithNuxtContext(nuxt3, async () => {
        await promise
        return tryUseNuxt()?.__name
      }),
    ])).resolves.toEqual(['1', '2', '3'])

    expect(tryUseNuxt()?.__name).toBeUndefined()
    expect(anotherKit.tryUseNuxt()?.__name).toBeUndefined()
  })

  it('should conflict error nested ctx with same kit', () => {
    const nuxt1 = { __name: '1' } as Nuxt
    const nuxt2 = { __name: '2' } as Nuxt

    expect(() => runWithNuxtContext(nuxt1, () =>
      runWithNuxtContext(nuxt2, () => tryUseNuxt()?.__name),
    )).toThrow(/conflict/)
  })

  it('should conflict error nested ctx with another kit', async () => {
    vi.resetModules()
    const anotherKit = await import('@nuxt/kit')

    expect(anotherKit.tryUseNuxt).not.toBe(tryUseNuxt)

    const nuxt1 = { __name: '1' } as Nuxt
    const nuxt2 = { __name: '2' } as Nuxt

    expect(() => runWithNuxtContext(nuxt1, () =>
      anotherKit.runWithNuxtContext(nuxt2, () => tryUseNuxt()?.__name),
    )).toThrow(/conflict/)
  })
})
