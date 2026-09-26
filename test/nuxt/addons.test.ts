/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />
import { describe, expect, it } from 'vitest'
import { defineEventHandler } from 'h3'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { computed, toValue } from 'vue'
import { defineUseAsyncDataAddon, defineUseFetchAddon } from '#app/composables/addons'
import type { AsyncDataAddonInstance, UseAsyncDataAddonOptions, UseFetchAddonOptions } from '#app/composables/addons'
import { createUseFetch as _createUseFetch } from '#app/composables/fetch'
import { createUseAsyncData as _createUseAsyncData } from '#app/composables/asyncData'
import type { AsyncDataExecuteOptions } from '#app/composables/asyncData'

const createUseFetch = (_createUseFetch as unknown as { __nuxt_factory: typeof _createUseFetch }).__nuxt_factory
const createUseAsyncData = (_createUseAsyncData as unknown as { __nuxt_factory: typeof _createUseAsyncData }).__nuxt_factory

registerEndpoint('/api/addons-test', defineEventHandler(event => ({
  method: event.req.method,
})))

describe('useFetch addons', () => {
  it('runs middleware around the request in addon order', async () => {
    const order: string[] = []
    const outer = defineUseFetchAddon({
      setup: (options) => {
        options.middleware.push(async (next) => {
          order.push('outer:before')
          const result = await next()
          order.push('outer:after')
          return result
        })
      },
    })
    const inner = defineUseFetchAddon({
      setup: (options) => {
        options.middleware.push(async (next) => {
          order.push('inner:before')
          const result = await next()
          order.push('inner:after')
          return result
        })
      },
    })

    const useCustomFetch = createUseFetch({ addons: [outer, inner] })
    await useCustomFetch('/api/addons-test', { key: 'addons:mw-order' })

    expect(order).toEqual(['outer:before', 'inner:before', 'inner:after', 'outer:after'])
  })

  it('supports typed custom options with defaults', async () => {
    const seen: Array<string | undefined> = []
    const tenant = defineUseFetchAddon({
      setup: (options: UseFetchAddonOptions<{ tenant?: string }>) => {
        options.tenant ??= 'default'
        options.middleware.push((next) => {
          seen.push(toValue(options.tenant))
          return next()
        })
      },
    })

    const useTenantFetch = createUseFetch({ addons: [tenant] })
    await useTenantFetch('/api/addons-test', { key: 'addons:tenant-a' })
    await useTenantFetch('/api/addons-test', { key: 'addons:tenant-b', tenant: 'foo' })

    expect(seen).toEqual(['default', 'foo'])
  })

  it('merges addon interceptors with caller interceptors instead of replacing them', async () => {
    const calls: string[] = []
    const addon = defineUseFetchAddon({
      setup: (options) => {
        options.onRequest.push(() => { calls.push('addon') })
      },
    })

    const useInterceptedFetch = createUseFetch({ addons: [addon] })
    await useInterceptedFetch('/api/addons-test', {
      key: 'addons:interceptors',
      onRequest: () => { calls.push('caller') },
    })

    expect(calls).toEqual(['caller', 'addon'])
  })

  it('lets middleware reshape the result before the caller transform', async () => {
    const addon = defineUseFetchAddon({
      setup: (options) => {
        options.middleware.push(async next => ({ ...(await next() as Record<string, unknown>), addon: true }))
      },
    })

    const useTransformedFetch = createUseFetch({ addons: [addon] })
    const { data } = await useTransformedFetch('/api/addons-test', {
      key: 'addons:transform-chain',
      transform: (d: Record<string, unknown>) => ({ ...d, callerSawAddon: d.addon === true }),
    })

    expect((data.value as Record<string, unknown>).callerSawAddon).toBe(true)
  })

  it('merges extensions into the return value, preserved through await', async () => {
    let fetches = 0
    const augment = defineUseFetchAddon({
      setup: (options) => {
        options.middleware.push((next) => {
          fetches++
          return next()
        })
        return instance => ({
          isSuccess: computed(() => instance.status.value === 'success'),
          refetch: () => instance.refresh(),
        })
      },
    })

    const useAugmentedFetch = createUseFetch({ addons: [augment] })
    const result = useAugmentedFetch('/api/addons-test', { key: 'addons:augment' })
    expect(result.isSuccess).toBeDefined()

    const awaited = await result
    expect(awaited.isSuccess.value).toBe(true)

    await awaited.refetch()
    expect(fetches).toBe(2)
  })

  it('contributes addon key segments to the auto-generated key', async () => {
    const nuxtApp = useNuxtApp()
    const getEntries = () => Object.keys(nuxtApp.payload.data).length
    const base = getEntries()

    const keyed = defineUseFetchAddon({
      key: options => toValue(options.scope),
      setup (options: UseFetchAddonOptions<{ scope?: string }>) {
        options.scope ??= 'a'
      },
    })

    const useKeyedFetch = createUseFetch({ addons: [keyed] })
    await useKeyedFetch('/api/addons-test', {}, 'addons-keyed')
    await useKeyedFetch('/api/addons-test', { scope: 'b' }, 'addons-keyed')
    expect(getEntries()).toBe(base + 2)

    await useKeyedFetch('/api/addons-test', { scope: 'a' }, 'addons-keyed')
    expect(getEntries()).toBe(base + 2)
  })

  it('does not include custom options in the key unless the addon resolves them', async () => {
    const nuxtApp = useNuxtApp()
    const getEntries = () => Object.keys(nuxtApp.payload.data).length
    const base = getEntries()

    const unkeyed = defineUseFetchAddon({ setup: (_options: UseFetchAddonOptions<{ delay?: number }>) => {} })

    const useUnkeyedFetch = createUseFetch({ addons: [unkeyed] })
    await useUnkeyedFetch('/api/addons-test', { delay: 1 }, 'addons-unkeyed')
    await useUnkeyedFetch('/api/addons-test', { delay: 2 }, 'addons-unkeyed')

    expect(getEntries()).toBe(base + 1)
  })

  it('deduplicates addons by reference', async () => {
    let setups = 0
    const addon = defineUseFetchAddon({ setup: () => { setups++ } })

    const useDedupedFetch = createUseFetch({ addons: [addon, addon] })
    await useDedupedFetch('/api/addons-test', { key: 'addons:dedupe' })

    expect(setups).toBe(1)
  })
  it('does not mutate factory-provided hook arrays across calls', async () => {
    const onRequest = [() => {}]
    const addon = defineUseFetchAddon({
      setup: (options) => { options.onRequest.push(() => {}) },
    })

    const useSharedFetch = createUseFetch({ onRequest, addons: [addon] })
    await useSharedFetch('/api/addons-test', { key: 'addons:shared-hooks-a' })
    await useSharedFetch('/api/addons-test', { key: 'addons:shared-hooks-b' })

    expect(onRequest).toHaveLength(1)
  })
})

describe('useAsyncData addons', () => {
  it('supports middleware and extensions', async () => {
    const addon = defineUseAsyncDataAddon({
      setup: (options: UseAsyncDataAddonOptions<{ suffix?: string }>) => {
        options.suffix ??= '!'
        options.middleware.push(async next => (await next()) + toValue(options.suffix)!)
        return instance => ({
          upper: computed(() => String(instance.data.value ?? '').toUpperCase()),
        })
      },
    })

    const useCustomAsyncData = createUseAsyncData({ addons: [addon] })
    const result = await useCustomAsyncData('addons:async-data', () => Promise.resolve('hi'))

    expect(result.data.value).toBe('hi!')
    expect(result.upper.value).toBe('HI!')
  })

  it('lets extensions override instance members', async () => {
    const addon = defineUseAsyncDataAddon({
      setup: () => (asyncData) => {
        const refresh = asyncData.refresh
        const wrapped = async (opts?: AsyncDataExecuteOptions) => {
          const result = await refresh(opts)
          if (asyncData.error.value) { throw asyncData.error.value }
          return result
        }
        return { refresh: wrapped, execute: wrapped }
      },
    })

    const useOverriddenAsyncData = createUseAsyncData({ addons: [addon] })

    let fail = false
    const result = useOverriddenAsyncData(
      'addons:override-execute',
      () => fail ? Promise.reject(new Error('boom')) : Promise.resolve('ok'),
      { immediate: false },
    )

    const { execute, refresh } = result

    await execute()
    expect(result.data.value).toBe('ok')

    fail = true
    await expect(refresh()).rejects.toThrow('boom')
    expect(result.status.value).toBe('error')

    const awaited = await result
    expect(awaited.execute).toBe(execute)
  })

  it('provides the abort signal to middleware', async () => {
    const signals: boolean[] = []
    const addon = defineUseAsyncDataAddon({
      setup: (options) => {
        options.middleware.push((next, ctx) => {
          signals.push(ctx.signal instanceof AbortSignal)
          return next()
        })
      },
    })

    const useCustomAsyncData = createUseAsyncData({ addons: [addon] })
    const result = await useCustomAsyncData('addons:signal', () => Promise.resolve(1))
    await result.refresh()

    expect(signals).toEqual([true, true])
  })
  it('does not mutate a factory-provided middleware array across calls', async () => {
    const calls: string[] = []
    const middleware = [(next: () => Promise<unknown>) => {
      calls.push('factory')
      return next()
    }]
    const addon = defineUseAsyncDataAddon({
      setup: (options) => {
        options.middleware.push((next) => {
          calls.push('addon')
          return next()
        })
      },
    })

    const useSharedAsyncData = createUseAsyncData({ middleware, addons: [addon] })
    await useSharedAsyncData('addons:shared-mw-a', () => Promise.resolve(1))
    await useSharedAsyncData('addons:shared-mw-b', () => Promise.resolve(1))

    expect(middleware).toHaveLength(1)
    expect(calls).toEqual(['factory', 'addon', 'factory', 'addon'])
  })
})

describe('addon extensions and promise methods', () => {
  it('does not merge `then`, `catch` or `finally` from an extension into the instance', async () => {
    const addon = defineUseAsyncDataAddon({
      setup: () => () => ({
        then: (next: (...args: unknown[]) => Promise<unknown>, ...args: unknown[]) => next(...args),
        marker: true,
      }),
    })

    const useGuardedAsyncData = createUseAsyncData({ addons: [addon] })
    const awaited = await useGuardedAsyncData('addons:no-thenable', () => Promise.resolve(1))

    expect(awaited.data.value).toBe(1)
    expect(awaited.marker).toBe(true)
    expect('then' in awaited).toBe(false)
  })
})

describe('addon extensions wrapping promise methods', () => {
  const rejectOnError = (asyncData: AsyncDataAddonInstance) =>
    (next: (...args: unknown[]) => Promise<unknown>, onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      next(() => {
        if (asyncData.error.value) { throw asyncData.error.value }
        return asyncData
      }).then(onFulfilled, onRejected)

  it('applies a `then` wrapper to a plain `await` of the composable', async () => {
    const addon = defineUseAsyncDataAddon({
      setup: () => asyncData => ({ then: rejectOnError(asyncData) }),
    })

    const useThrowingAsyncData = createUseAsyncData({ addons: [addon] })

    await expect((async () => {
      await useThrowingAsyncData('addons:then-await', () => Promise.reject(new Error('boom')))
    })()).rejects.toThrow('boom')
  })

  it('resolves `await` with the intact instance and does not merge the wrapper into it', async () => {
    let captured: unknown
    const addon = defineUseAsyncDataAddon({
      setup: () => (asyncData) => {
        captured = asyncData
        return {
          doubled: computed(() => Number(asyncData.data.value ?? 0) * 2),
          then: rejectOnError(asyncData),
        }
      },
    })

    const useWrappedAsyncData = createUseAsyncData({ addons: [addon] })
    const result = useWrappedAsyncData('addons:then-identity', () => Promise.resolve(21))
    expect(result).toBeInstanceOf(Promise)
    const awaited = await result

    expect(awaited.data).toBe((captured as AsyncDataAddonInstance).data)
    expect(awaited.data.value).toBe(21)
    expect(awaited.doubled.value).toBe(42)
    expect('then' in awaited).toBe(false)
  })

  it('applies a `catch` wrapper to explicit `.catch()` calls', async () => {
    const seen: string[] = []
    const addon = defineUseAsyncDataAddon({
      setup: () => asyncData => ({
        then: rejectOnError(asyncData),
        catch: (next: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>, onRejected?: (reason: unknown) => unknown) => {
          seen.push('wrapper')
          return next(onRejected)
        },
      }),
    })

    const useThrowingAsyncData = createUseAsyncData({ addons: [addon] })
    const result = useThrowingAsyncData('addons:catch-wrap', () => Promise.reject(new Error('boom')))
    await result.catch((error) => { seen.push((error as Error).message) })

    expect(seen).toEqual(['wrapper', 'boom'])
  })

  it('applies a `finally` wrapper to explicit `.finally()` calls', async () => {
    const seen: string[] = []
    const addon = defineUseAsyncDataAddon({
      setup: () => () => ({
        finally: (next: (onFinally?: () => void) => Promise<unknown>, onFinally?: () => void) => {
          seen.push('wrapper')
          return next(onFinally)
        },
      }),
    })

    const useWrappedAsyncData = createUseAsyncData({ addons: [addon] })
    const result = useWrappedAsyncData('addons:finally-wrap', () => Promise.resolve('ok'))
    const awaited = await result.finally(() => { seen.push('finally') })

    expect(seen).toEqual(['wrapper', 'finally'])
    expect(awaited.data.value).toBe('ok')
  })

  it('composes `then` wrappers across addons (first addon outermost)', async () => {
    const settled: string[] = []
    const make = (name: string) => defineUseAsyncDataAddon({
      setup: () => () => ({
        then: (next: (...args: unknown[]) => Promise<unknown>, onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
          next((value: unknown) => {
            settled.push(name)
            return onFulfilled?.(value)
          }, onRejected),
      }),
    })

    const useComposedAsyncData = createUseAsyncData({ addons: [make('outer'), make('inner')] })
    await useComposedAsyncData('addons:then-order', () => Promise.resolve('ok'))

    expect(settled).toEqual(['inner', 'outer'])
  })

  it('does not cause an unhandled rejection when a rejecting wrapper is never awaited', async () => {
    const addon = defineUseAsyncDataAddon({
      setup: () => instance => ({ then: rejectOnError(instance) }),
    })

    const useThrowingAsyncData = createUseAsyncData({ addons: [addon] })
    const { error } = useThrowingAsyncData('addons:then-unawaited', () => Promise.reject(new Error('boom')))

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(error.value).toBeTruthy()
  })

  it('supports promise-method wrappers via createUseFetch', async () => {
    registerEndpoint('/api/addons-then-throw', defineEventHandler(() => {
      throw new Error('fetch error')
    }))

    const addon = defineUseFetchAddon({
      setup: () => asyncData => ({ then: rejectOnError(asyncData) }),
    })

    const useThrowingFetch = createUseFetch({ addons: [addon] })

    await expect((async () => {
      await useThrowingFetch('/api/addons-then-throw', { key: 'addons:fetch-then' })
    })()).rejects.toThrow()
  })
})
