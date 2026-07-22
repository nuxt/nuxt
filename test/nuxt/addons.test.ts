/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />
import { describe, expect, it } from 'vitest'
import { defineEventHandler } from 'h3'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { computed, toValue } from 'vue'
import { defineUseAsyncDataAddon, defineUseFetchAddon } from '#app/composables/addons'
import type { UseAsyncDataAddonOptions, UseFetchAddonOptions } from '#app/composables/addons'
import { createUseFetch as _createUseFetch } from '#app/composables/fetch'
import { createUseAsyncData as _createUseAsyncData } from '#app/composables/asyncData'

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

  it('resolves addons from override-mode factory options', async () => {
    const seen: boolean[] = []
    const addon = defineUseFetchAddon({
      setup: (options: UseFetchAddonOptions<{ flag?: boolean }>) => {
        options.flag ??= false
        options.middleware.push((next) => {
          seen.push(toValue(options.flag)!)
          return next()
        })
      },
    })

    const useOverrideFetch = createUseFetch(() => ({ addons: [addon] }))
    await useOverrideFetch('/api/addons-test', { key: 'addons:override-mode', flag: true })

    expect(seen).toEqual([true])
  })

  it('deduplicates addons by reference', async () => {
    let setups = 0
    const addon = defineUseFetchAddon({ setup: () => { setups++ } })

    const useDedupedFetch = createUseFetch({ addons: [addon, addon] })
    await useDedupedFetch('/api/addons-test', { key: 'addons:dedupe' })

    expect(setups).toBe(1)
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
})
