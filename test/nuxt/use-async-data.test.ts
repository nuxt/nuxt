/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineEventHandler } from 'h3'

import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

import { flushPromises } from '@vue/test-utils'
import { Transition } from 'vue'

import type { NuxtApp } from '#app/nuxt'
import { clearNuxtData, refreshNuxtData, useAsyncData, useLazyAsyncData, useNuxtData } from '#app/composables/asyncData'

registerEndpoint('/api/test', defineEventHandler(event => ({
  method: event.method,
  headers: Object.fromEntries(event.headers.entries()),
})))

registerEndpoint('/api/sleep', defineEventHandler((event) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ method: event.method, headers: Object.fromEntries(event.headers.entries()) })
    }, 100)
  })
}))

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('useAsyncData', () => {
  let uniqueKey: string
  let counter = 0

  beforeEach(() => {
    uniqueKey = `key-${++counter}`
  })

  function mountWithAsyncData (...args: any[]) {
    return new Promise<ReturnType<typeof useAsyncData> & ReturnType<typeof mountSuspended<unknown>>>((resolve) => {
      let res: ReturnType<typeof useAsyncData & ReturnType<typeof mountSuspended>>
      const component = defineComponent({
        setup () {
          res = useAsyncData(...args as [any])
          return () => h('div', [res.data.value as any])
        },
      })

      mountSuspended(component).then(c => resolve(Object.assign(c, res)))
    })
  }

  it('should work at basic level', async () => {
    const res = useAsyncData(() => Promise.resolve('test'))
    expect(Object.keys(res).sort()).toMatchInlineSnapshot(`
      [
        "clear",
        "data",
        "error",
        "execute",
        "pending",
        "refresh",
        "status",
      ]
    `)
    expect(res instanceof Promise).toBeTruthy()
    expect(res.data.value).toBe(undefined)
    await res
    expect(res.data.value).toBe('test')
  })

  it('should not execute with immediate: false', async () => {
    const immediate = await useAsyncData(() => Promise.resolve('test'))
    expect(immediate.data.value).toBe('test')
    expect(immediate.status.value).toBe('success')
    expect(immediate.pending.value).toBe(false)

    const nonimmediate = await useAsyncData(() => Promise.resolve('test'), { immediate: false })
    expect(nonimmediate.data.value).toBe(undefined)
    expect(nonimmediate.status.value).toBe('idle')
    expect(nonimmediate.pending.value).toBe(false)
  })

  it('should capture errors', async () => {
    vi.stubGlobal('__TEST_DEV__', true)

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { data, error, status, pending } = await useAsyncData(uniqueKey, () => Promise.reject(new Error('test')), { default: () => 'default' })
    expect(data.value).toMatchInlineSnapshot('"default"')
    expect(error.value).toMatchInlineSnapshot('[Error: test]')
    expect(status.value).toBe('error')
    expect(pending.value).toBe(false)
    expect(useNuxtApp().payload._errors[uniqueKey]).toMatchInlineSnapshot('[Error: test]')

    const { data: syncedData, error: syncedError, status: syncedStatus, pending: syncedPending } = await useAsyncData(uniqueKey, () => ({} as any), { immediate: false })

    expect(syncedData.value).toBe(data.value)
    expect(syncedError.value).toBe(error.value)
    expect(syncedStatus.value).toBe(status.value)
    expect(syncedPending.value).toBe(false)

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(
      /\[nuxt\] \[useAsyncData\] Incompatible options detected for "[^"]+" \(used at .*:\d+:\d+\):\n- different handler\n- different `default` value\nYou can use a different key or move the call to a composable to ensure the options are shared across calls./,
    ))
    warn.mockRestore()
    vi.unstubAllGlobals()
  })

  // https://github.com/nuxt/nuxt/issues/23411
  it('should initialize with error set to null when immediate: false', async () => {
    const { error, execute } = useAsyncData(() => Promise.resolve({}), { immediate: false })
    expect(error.value).toBe(undefined)
    await execute()
    expect(error.value).toBe(undefined)
  })

  it('should be accessible with useNuxtData', async () => {
    await useAsyncData(uniqueKey, () => Promise.resolve('test'))
    const data = useNuxtData(uniqueKey)
    expect(data.data.value).toMatchInlineSnapshot('"test"')
    clearNuxtData(uniqueKey)
    expect(data.data.value).toBeUndefined()
    expect(useNuxtData(uniqueKey).data.value).toBeUndefined()
  })

  it('should be usable _after_ a useNuxtData call', async () => {
    useNuxtApp().payload.data[uniqueKey] = null
    const { data: cachedData } = useNuxtData(uniqueKey)
    expect(cachedData.value).toMatchInlineSnapshot('null')
    const { data } = await useAsyncData(uniqueKey, () => Promise.resolve({ resolved: true }), { server: false })
    expect(cachedData.value).toMatchInlineSnapshot(`
      {
        "resolved": true,
      }
    `)
    expect(data.value).toStrictEqual(cachedData.value)
    clearNuxtData(uniqueKey)
  })

  it('should be usable _after_ a useNuxtData call after navigation', async () => {
    const getData = async () => {
      const wrapper = await mountSuspended(({
        async setup () {
          useNuxtData(uniqueKey)
          const { data } = await useAsyncData(uniqueKey, () => Promise.resolve('foo'))
          return () => h('div', [data.value])
        },
      }))
      try {
        return wrapper.html({ raw: true })
      } finally {
        wrapper.unmount()
      }
    }
    useNuxtApp().payload.data[uniqueKey] = null
    expect(await getData()).toMatchInlineSnapshot(`"<div>foo</div>"`)
    // simulate a second visit to the page
    expect(await getData()).toMatchInlineSnapshot(`"<div>foo</div>"`)
  })

  it('should be refreshable', async () => {
    await useAsyncData(uniqueKey, () => Promise.resolve('test'))
    clearNuxtData(uniqueKey)
    const data = useNuxtData(uniqueKey)
    expect(data.data.value).toBeUndefined()
    await refreshNuxtData(uniqueKey)
    expect(data.data.value).toMatchInlineSnapshot('"test"')
  })

  it('should allow overriding requests', async () => {
    vi.useFakeTimers()

    let count = 0
    let timeout = 0
    // pretending we're hydrating a server rendered app
    const nuxtApp = useNuxtApp()
    nuxtApp.payload.data[uniqueKey] = 1

    const fetcher = vi.fn(() => new Promise(resolve => setTimeout(() => resolve(++count), timeout)))
    const { data, refresh } = await useAsyncData(uniqueKey, fetcher, {
      getCachedData (key, nuxtApp, context) {
        // force bypass cache after first load (equivalent to previous `_initial: false`)
        if (context.cause === 'initial') {
          return nuxtApp.payload.data[key]
        }
      },
    })

    expect(fetcher).not.toHaveBeenCalled()
    expect.soft(count).toBe(0)
    expect.soft(data.value).toBe(1)

    timeout = 100
    const p = refresh({ dedupe: 'cancel' })

    expect(fetcher).toHaveBeenCalled()

    expect.soft(count).toBe(0)
    expect.soft(data.value).toBe(1)

    timeout = 0
    const refreshPromise = refresh()
    vi.advanceTimersByTime(0)
    await refreshPromise

    expect.soft(count).toBe(1)
    expect.soft(data.value).toBe(1)

    vi.advanceTimersByTime(100)
    await p

    expect.soft(count).toBe(2)
    expect.soft(data.value).toBe(1)

    vi.useRealTimers()
  })

  it('should be clearable', async () => {
    const { data, error, pending, status, clear } = await useAsyncData(() => Promise.resolve('test'))
    expect(data.value).toBe('test')

    clear()

    expect(data.value).toBeUndefined()
    expect(error.value).toBe(undefined)
    expect(pending.value).toBe(false)
    expect(status.value).toBe('idle')
  })

  it('should have correct status for previously fetched requests', async () => {
    vi.useFakeTimers()

    const route = useRoute()

    const res = await mountWithAsyncData(route.fullPath,
      async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        return 'test'
      }, { lazy: true },
    )

    expect(res.data.value).toBe(undefined)
    expect(res.status.value).toBe('pending')
    expect(res.pending.value).toBe(true)

    vi.advanceTimersByTime(1)
    await flushPromises()

    expect(res.data.value).toBe('test')
    expect(res.status.value).toBe('success')
    expect(res.pending.value).toBe(false)

    res.unmount()

    await flushPromises()

    expect(res.data.value).toBe(undefined)
    expect(res.status.value).toBe('idle')
    expect(res.pending.value).toBe(false)

    const res2 = await mountWithAsyncData(route.fullPath,
      async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        return 'test'
      }, { lazy: true },
    )

    expect(res2.data.value).toBe(undefined)
    expect(res2.status.value).toBe('pending')
    expect(res2.pending.value).toBe(true)

    vi.advanceTimersByTime(1)
    await flushPromises()

    expect(res2.data.value).toBe('test')
    expect(res2.status.value).toBe('success')
    expect(res2.pending.value).toBe(false)

    vi.useRealTimers()
  })

  it('should be refreshable with force and cache', async () => {
    await useAsyncData(uniqueKey, () => Promise.resolve('test'), {
      getCachedData: (key, nuxtApp, ctx) => {
        return ctx.cause
      },
    })
    await refreshNuxtData(uniqueKey)
    await nextTick()
    const data = useNuxtData(uniqueKey)
    expect(data.data.value).toMatchInlineSnapshot('"refresh:hook"')
  })

  it('allows custom access to a cache', async () => {
    const { data } = await useAsyncData(() => Promise.resolve({ val: true }), { getCachedData: () => ({ val: false }) })
    expect(data.value).toMatchInlineSnapshot(`
      {
        "val": false,
      }
    `)
  })

  it('should only call getCachedData once', async () => {
    const getCachedData = vi.fn(() => ({ val: false }))
    const { data } = await useAsyncData(() => Promise.resolve({ val: true }), { getCachedData })
    expect(data.value).toMatchInlineSnapshot(`
      {
        "val": false,
      }
    `)
    expect(getCachedData).toHaveBeenCalledTimes(1)
  })

  it('will use cache on refresh by default', async () => {
    const { data, refresh } = await useAsyncData(() => Promise.resolve('other value'), { getCachedData: () => 'cached' })
    expect(data.value).toBe('cached')
    await refresh()
    expect(data.value).toBe('cached')
  })

  it('getCachedData should receive triggeredBy on initial fetch', async () => {
    const { data } = await useAsyncData(() => Promise.resolve(''), { getCachedData: (key, nuxtApp, ctx) => ctx.cause })
    expect(data.value).toBe('initial')
  })

  it('getCachedData should receive triggeredBy on manual refresh', async () => {
    const { data, refresh } = await useAsyncData(() => Promise.resolve(''), {
      getCachedData: (key, nuxtApp, ctx) => ctx.cause,
    })
    await refresh()
    expect(data.value).toBe('refresh:manual')
  })

  it('getCachedData should receive triggeredBy on watch', async () => {
    const number = ref(0)
    const { data } = await useAsyncData(() => Promise.resolve(''), {
      getCachedData: (key, nuxtApp, ctx) => ctx.cause,
      watch: [number],
    })
    number.value = 1
    await flushPromises()
    expect(data.value).toBe('watch')
  })

  it('should use default while pending', async () => {
    const promise = useAsyncData(() => Promise.resolve('test'), { default: () => 'default' })
    const { data, pending } = promise

    expect(pending.value).toBe(true)
    expect(data.value).toMatchInlineSnapshot('"default"')

    await promise
    expect(data.value).toMatchInlineSnapshot('"test"')
  })

  it('should use default after reject', async () => {
    const { data } = await useAsyncData(() => Promise.reject(new Error('test')), { default: () => 'default' })
    expect(data.value).toMatchInlineSnapshot('"default"')
  })

  it('should execute the promise function once when dedupe option is "defer" for multiple calls', () => {
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    useAsyncData(uniqueKey, promiseFn, { dedupe: 'defer' })
    useAsyncData(uniqueKey, promiseFn, { dedupe: 'defer' })
    useAsyncData(uniqueKey, promiseFn, { dedupe: 'defer' })

    expect(promiseFn).toHaveBeenCalledTimes(1)
  })

  it('should watch params deeply in a non synchronous way', async () => {
    const foo = ref('foo')
    const baz = ref('baz')
    const locale = ref('en')

    type Params = { deep: { baz: string }, foo?: string, locale?: string }
    const params = reactive<Params>({ deep: { baz: 'baz' } })

    watch(foo, (foo) => {
      params.foo = foo
      params.locale = locale.value
    }, { immediate: true })

    watch(baz, (baz) => {
      params.deep.baz = baz
    }, { immediate: true })

    const requestHistory: Array<Record<string, unknown>> = []

    // 1. first request
    await useAsyncData(uniqueKey, async () => {
      requestHistory.push(JSON.parse(JSON.stringify(params)))
      await Promise.resolve()
    }, { watch: [params] })

    // 2. second request
    foo.value = 'bar'
    locale.value = 'fr'
    // We need to wait for the debounce 0
    await new Promise(resolve => setTimeout(resolve, 5))

    // 3. third request
    baz.value = 'bar'
    await nextTick()

    expect(requestHistory).toEqual([
      {
        deep: { baz: 'baz' },
        foo: 'foo',
        locale: 'en',
      },
      {
        deep: { baz: 'baz' },
        foo: 'bar',
        locale: 'fr',
      },
      {
        deep: { baz: 'bar' },
        foo: 'bar',
        locale: 'fr',
      },
    ])
  })

  it('should execute the promise function multiple times when dedupe option is not specified for multiple calls', () => {
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    useAsyncData(uniqueKey, promiseFn)
    useAsyncData(uniqueKey, promiseFn)
    useAsyncData(uniqueKey, promiseFn)

    expect(promiseFn).toHaveBeenCalledTimes(3)
  })

  it('should execute the promise function as per dedupe option when different dedupe options are used for multiple calls', () => {
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    useAsyncData(uniqueKey, promiseFn, { dedupe: 'defer' })
    useAsyncData(uniqueKey, promiseFn)
    useAsyncData(uniqueKey, promiseFn, { dedupe: 'defer' })

    expect(promiseFn).toHaveBeenCalledTimes(2)
  })

  it('should warn if incompatible options are used', async () => {
    vi.stubGlobal('__TEST_DEV__', true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await mountWithAsyncData('dedupedKey3', () => Promise.resolve('test'), { deep: false })
    expect(warn).not.toHaveBeenCalled()
    await mountWithAsyncData('dedupedKey3', () => Promise.resolve('test'), { deep: true })
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(
      /\[nuxt\] \[useAsyncData\] Incompatible options detected for "dedupedKey3" \(used at .*:\d+:\d+\):\n- mismatching `deep` option\nYou can use a different key or move the call to a composable to ensure the options are shared across calls./,
    ))

    let count = 0
    for (const opt of ['transform', 'pick', 'getCachedData'] as const) {
      warn.mockClear()
      count++

      await mountWithAsyncData(`${uniqueKey}-${count}`, () => Promise.resolve('test'), { [opt]: () => ({}) })
      await mountWithAsyncData(`${uniqueKey}-${count}`, () => Promise.resolve('test'), { [opt]: () => ({}) })
      expect(warn).not.toHaveBeenCalled()
      await mountWithAsyncData(`${uniqueKey}-${count}`, () => Promise.resolve('test'))
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(`\\[nuxt\\] \\[useAsyncData\\] Incompatible options detected for "${uniqueKey}-${count}" \\(used at .*:\\d+:\\d+\\):\n- different \`${opt}\` option\nYou can use a different key or move the call to a composable to ensure the options are shared across calls.`),
        ))
    }

    warn.mockClear()
    count++

    await mountWithAsyncData(`${uniqueKey}-${count}`, () => Promise.resolve('test'))
    expect(warn).not.toHaveBeenCalled()
    await mountWithAsyncData(`${uniqueKey}-${count}`, () => Promise.resolve('bob'))
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(
      new RegExp(`\\[nuxt\\] \\[useAsyncData\\] Incompatible options detected for "${uniqueKey}-${count}" \\(used at .*:\\d+:\\d+\\):\n- different handler\nYou can use a different key or move the call to a composable to ensure the options are shared across calls.`),
    ))

    warn.mockReset()
    vi.unstubAllGlobals()
  })

  it('should only refresh asyncdata once when watched dependency is updated', async () => {
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    const route = ref('/')
    const component = defineComponent({
      setup () {
        const { data } = useAsyncData(uniqueKey, promiseFn, { watch: [route] })
        return () => h('div', [data.value])
      },
    })

    await mountSuspended(component)
    expect(promiseFn).toHaveBeenCalledTimes(1)

    await mountSuspended(component)
    expect(promiseFn).toHaveBeenCalledTimes(1)

    route.value = '/about'
    await nextTick()
    expect(promiseFn).toHaveBeenCalledTimes(2)
  })

  it('should work correctly with nested components accessing the same asyncData', async () => {
    const useCustomData = () => useAsyncData(uniqueKey, async () => {
      await Promise.resolve()
      return 'value'
    })

    const ChildComponent = defineComponent({
      setup () {
        const { data } = useCustomData()
        return () => h('div', ['Child ' + data.value])
      },
    })

    const ParentComponent = defineComponent({
      async setup () {
        const { data, pending } = await useCustomData()
        return () => h('div', [
          'Parent ' + data.value,
          h('br'),
          pending.value ? ' loading ... ' : h(ChildComponent),
        ])
      },
    })

    const wrapper = await mountSuspended(ParentComponent)
    await nextTick()
    await flushPromises()

    expect(wrapper.html()).not.toContain('loading')
  })

  const key = ref()
  const cases = [
    { name: 'ref', getter: key },
    { name: 'getter', getter: () => key.value },
  ]

  it.each(cases)('should work with keys computed from $name', async ({ name, getter }) => {
    const firstKey = `${name}-firstKey`
    const secondKey = `${name}-secondKey`
    key.value = firstKey

    const promiseFn = vi.fn(() => Promise.resolve(key.value))
    const component = defineComponent({
      setup () {
        const { data } = useAsyncData(getter, promiseFn)
        return () => h('div', [data.value])
      },
    })

    const comp = await mountSuspended(component)
    expect(promiseFn).toHaveBeenCalledTimes(1)

    key.value = secondKey
    await flushPromises()
    expect(promiseFn).toHaveBeenCalledTimes(2)

    expect(useNuxtData(firstKey).data.value).toBeUndefined()
    expect(useNuxtData(secondKey).data.value).toBe(secondKey)

    expect(useNuxtApp()._asyncData[firstKey]!.data.value).toBe(undefined)
    expect(useNuxtApp()._asyncData[secondKey]!.data.value).toBe(secondKey)

    comp.unmount()
  })

  it('should clear memory when last component using asyncData is unmounted', async () => {
    const key = 'several'
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    const component = defineComponent({
      setup () {
        const { data } = useAsyncData(key, promiseFn)
        return () => h('div', [data.value])
      },
    })
    const getData = async () => {
      const component = await mountSuspended(defineComponent({
        setup () {
          const { data } = useNuxtData(key)
          return () => data.value === undefined ? 'undefined' : data.value
        },
      }))
      try {
        return component.html({ raw: true })
      } finally {
        component.unmount()
      }
    }

    const comp1 = await mountSuspended(component)
    expect(promiseFn).toHaveBeenCalledTimes(1)

    const comp2 = await mountSuspended(component)
    expect(promiseFn).toHaveBeenCalledTimes(1)

    comp1.unmount()
    await nextTick()
    expect(await getData()).toMatchInlineSnapshot('"test"')

    comp2.unmount()
    await nextTick()
    expect(await getData()).toBe('undefined')
  })

  it('should remain reactive after being reinitialised', async () => {
    const promiseFn = vi.fn((value: string) => Promise.resolve(value))
    const component = (value: string) => defineComponent({
      setup () {
        const { data } = useAsyncData('fixed', () => promiseFn(value))
        return () => h('div', [data.value])
      },
    })

    const comp1 = await mountSuspended(component('first'))
    expect(promiseFn).toHaveBeenCalledTimes(1)
    comp1.unmount()

    const comp2 = await mountSuspended(component('second'))
    expect(promiseFn).toHaveBeenCalledTimes(2)
    expect(promiseFn).toHaveBeenLastCalledWith('second')
    expect(comp2.html()).toMatchInlineSnapshot(`"<div>second</div>"`)
  })

  it('should be synced with useNuxtData', async () => {
    const { data: nuxtData } = useNuxtData('nuxtdata-sync')
    const promise = useAsyncData('nuxtdata-sync', () => Promise.resolve('test'), { default: () => 'default' })
    const { data: fetchData } = promise

    expect(fetchData.value).toMatchInlineSnapshot('"default"')

    nuxtData.value = 'before-fetch'
    expect(fetchData.value).toMatchInlineSnapshot('"before-fetch"')

    await promise
    expect(fetchData.value).toMatchInlineSnapshot('"test"')
    expect(nuxtData.value).toMatchInlineSnapshot('"test"')

    nuxtData.value = 'new value'
    expect(fetchData.value).toMatchInlineSnapshot('"new value"')
    fetchData.value = 'another value'
    expect(nuxtData.value).toMatchInlineSnapshot('"another value"')
  })

  it('should work when used in a Transition', async () => {
    const id = ref('foo')
    const ComponentWithAsyncData = defineComponent({
      props: { id: String },
      async setup (props) {
        const { data } = await useAsyncData(`quote:${props.id}`, () => Promise.resolve({ content: props.id }))
        return () => h('div', data.value?.content)
      },
    })
    const ComponentWithTransition = defineComponent({
      setup: () => () => h(Transition, { name: 'test' }, {
        default: () => h(ComponentWithAsyncData, { id: id.value, key: id.value }),
      }),
    })
    async function setTo (newId: string) {
      id.value = newId
      for (let i = 0; i < 5; i++) {
        await nextTick()
        await flushPromises()
      }
    }

    const wrapper = await mountSuspended(ComponentWithTransition, { global: { stubs: { transition: false } } })
    await setTo('foo')
    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>foo</div>"`)

    await setTo('bar')
    expect(wrapper.html()).toMatchInlineSnapshot(`"<div class="">bar</div>"`)

    await setTo('foo')
    expect(wrapper.html()).toMatchInlineSnapshot(`"<div class="">foo</div>"`)
  })

  it('duplicate calls are not made after first call has finished', async () => {
    const handler = vi.fn(() => Promise.resolve('hello'))
    const getCachedData = vi.fn((key: string, nuxtApp: NuxtApp) => {
      return nuxtApp.payload.data[key]
    })

    function testAsyncData () {
      return useAsyncData(uniqueKey, handler, {
        getCachedData,
      })
    }

    const { status, data } = await testAsyncData()
    expect(status.value).toBe('success')
    expect(data.value).toBe('hello')
    expect(handler).toHaveBeenCalledTimes(1)
    expect.soft(getCachedData).toHaveBeenCalledTimes(1)

    const { status: status2, data: data2 } = testAsyncData()
    expect.soft(handler).toHaveBeenCalledTimes(1)
    expect.soft(getCachedData).toHaveBeenCalledTimes(1)
    expect.soft(data.value).toBe('hello')
    expect.soft(data2.value).toBe('hello')
    expect.soft(status.value).toBe('success')
    expect.soft(status2.value).toBe('success')

    await flushPromises()
    await nextTick()
    await flushPromises()

    expect.soft(handler).toHaveBeenCalledTimes(1)
    expect.soft(getCachedData).toHaveBeenCalledTimes(1)
  })

  it('should not execute if immediate is false and only the key changes', async () => {
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    const key = shallowRef('a')
    const { status } = useAsyncData(key, promiseFn, { immediate: false })

    expect.soft(status.value).toBe('idle')
    expect.soft(promiseFn).toHaveBeenCalledTimes(0)

    key.value += 'a'
    await nextTick()
    expect.soft(status.value).toBe('idle')
    expect.soft(promiseFn).toHaveBeenCalledTimes(0)
  })

  it('should pick values from data', async () => {
    const { data } = await useAsyncData(() => Promise.resolve({ a: 1, b: 2 }), { pick: ['a'] })
    expect(data.value).toStrictEqual({ a: 1 })
  })

  it('should transform data', async () => {
    const { data } = await useAsyncData(() => Promise.resolve({ a: 1, b: 2 }), { transform: data => ({ c: data.a }) })
    expect(data.value).toStrictEqual({ c: 1 })
  })

  it('should use default value with lazy', async () => {
    vi.useFakeTimers()

    const { data, pending } = useLazyAsyncData(() => new Promise(resolve => setTimeout(() => resolve('test'), 10)), { default: () => 'default' })
    expect(pending.value).toBe(true)
    expect(data.value).toBe('default')

    vi.advanceTimersByTime(10)
    await flushPromises()

    expect(data.value).toBe('test')

    vi.useRealTimers()
  })

  it('should not execute with immediate: false and be executable', async () => {
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    const { data, status, execute } = useAsyncData(promiseFn, { immediate: false })
    expect(data.value).toBe(undefined)
    expect(status.value).toBe('idle')
    expect(promiseFn).toHaveBeenCalledTimes(0)
    await execute()
    expect(data.value).toBe('test')
    expect(status.value).toBe('success')
    expect(promiseFn).toHaveBeenCalledTimes(1)
  })

  it('should handle being passed to watch', async () => {
    const q = ref<null | string>('test')
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    const { execute } = useAsyncData(promiseFn, { immediate: false })
    expect(promiseFn).toHaveBeenCalledTimes(0)

    // @ts-expect-error type is not valid
    watch(q, execute)

    expect(promiseFn).toHaveBeenCalledTimes(0)

    q.value = null
    await nextTick()
    await flushPromises()
    expect(promiseFn).toHaveBeenCalledTimes(1)
  })

  it('should not refetch on the client when hydrating', () => {
    useNuxtData(uniqueKey).data.value = 'server-renderered'
    useNuxtApp().isHydrating = true
    const { data, status } = useAsyncData(uniqueKey, () => Promise.resolve('test'))
    expect(data.value).toBe('server-renderered')
    expect(status.value).toBe('success')
    useNuxtApp().isHydrating = false
  })

  it('should retain the old data when a computed key changes', async () => {
    vi.useFakeTimers()
    const page = ref('index')
    const promiseFn = vi.fn(() => new Promise(resolve => setTimeout(() => resolve(page.value), 100)))
    const { data, status } = useAsyncData(() => page.value, promiseFn)

    vi.advanceTimersToNextTimer()
    await flushPromises()
    expect(data.value).toBe('index')
    expect(promiseFn).toHaveBeenCalledTimes(1)

    page.value = 'about'
    await nextTick()
    await flushPromises()
    expect(promiseFn).toHaveBeenCalledTimes(2)
    expect(data.value).toBe('index')
    expect(status.value).toBe('pending')

    vi.advanceTimersToNextTimer()
    await flushPromises()
    await nextTick()
    expect(data.value).toBe('about')
    expect(promiseFn).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  // https://github.com/nuxt/nuxt/issues/33274
  it('should not execute handler multiple times when external watch is defined before useAsyncData with computed key', async () => {
    const q = ref('')
    const promiseFn = vi.fn((query: string) => Promise.resolve(`result for: ${query}`))

    // watch must be defined before useAsyncData to reproduce the bug
    watch(q, () => {})

    const { data, error } = await useAsyncData(
      () => `query-${q.value}`,
      () => promiseFn(q.value),
      {
        watch: [q],
        immediate: true,
      },
    )

    // Initial execute
    expect(data.value).toBe('result for: ')
    expect(promiseFn).toHaveBeenCalledTimes(1)
    expect(promiseFn).toHaveBeenNthCalledWith(1, '')

    // First key change
    q.value = 's'
    await nextTick()
    await flushPromises()

    expect(promiseFn).toHaveBeenCalledTimes(2)
    expect(promiseFn).toHaveBeenNthCalledWith(2, 's')
    expect(error.value).toBe(undefined)
    expect(data.value).toBe('result for: s')

    // Second key change
    q.value = 'se'
    await nextTick()
    await flushPromises()

    expect(promiseFn).toHaveBeenCalledTimes(3)
    expect(promiseFn).toHaveBeenNthCalledWith(3, 'se')
    expect(error.value).toBe(undefined)
    expect(data.value).toBe('result for: se')
  })

  it('should automatically re-execute when watched dependency changes', async () => {
    const q = ref('')
    const promiseFn = vi.fn((query: string) => Promise.resolve(`result for: ${query}`))

    const externalWatchSpy = vi.fn()
    watch(q, externalWatchSpy)

    const { data, error } = await useAsyncData(
      () => `auto-query-${q.value}`,
      () => promiseFn(q.value),
      {
        watch: [q],
        immediate: true,
      },
    )

    expect(data.value).toBe('result for: ')
    expect(promiseFn).toHaveBeenCalledWith('')

    // First change triggers automatic request
    q.value = 's'
    await nextTick()
    await flushPromises()

    expect(error.value).toBe(undefined)
    expect(data.value).toBe('result for: s')
    expect(promiseFn).toHaveBeenCalledWith('s')

    // Second change
    q.value = 'se'
    await nextTick()
    await flushPromises()

    expect(error.value).toBe(undefined)
    expect(data.value).toBe('result for: se')
    expect(promiseFn).toHaveBeenCalledWith('se')

    expect(externalWatchSpy).toHaveBeenCalledTimes(2)
    expect(promiseFn).toHaveBeenCalledTimes(3) // initial + 2 changes
  })

  it('should trigger AbortController on clear', () => {
    let aborted = false

    class Mock {
      signal = { aborted: false }
      abort = () => {
        this.signal.aborted = true
        aborted = true
      }
    }
    vi.stubGlobal('AbortController',
      Mock,
    )
    const { promise, resolve } = Promise.withResolvers<boolean>()
    const { clear } = useAsyncData('', () => promise)
    expect(aborted).toBe(false)
    clear()
    resolve(true)
    expect(aborted).toBe(true)
  })

  it('should be externally cancellable when executing', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const promiseFn = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('index'), 1000)))
    const { execute, status } = useAsyncData(() => 'index', promiseFn)
    vi.advanceTimersToNextTimer()
    await flushPromises()
    expect(status.value).toBe('success')
    execute({ signal: controller.signal })
    vi.advanceTimersByTime(100)
    expect(status.value).toBe('pending')
    controller.abort('test abort')
    await flushPromises()
    expect(status.value).toBe('idle')
    vi.useRealTimers()
  })

  it('should be cancellable via abort', async () => {
    vi.useFakeTimers()
    let count = 0
    const promiseFn = vi.fn(() => new Promise(resolve => setTimeout(() => resolve(count++), 1000)))
    const { clear, status } = useAsyncData(promiseFn)
    expect(status.value).toBe('pending')
    clear()
    await nextTick()
    await flushPromises()
    expect(status.value).toBe('idle')
    expect(count).toBe(0)
    vi.useRealTimers()
  })

  it('should abort handler signal', async () => {
    vi.useFakeTimers()
    let _signal: AbortController['signal']
    const promiseFn = vi.fn((_, { signal }) => {
      _signal = signal
      return new Promise(resolve => setTimeout(() => resolve('index'), 1000))
    })
    const { clear, status } = useAsyncData(promiseFn)
    expect(status.value).toBe('pending')
    clear()
    await nextTick()
    await flushPromises()
    expect(_signal!.aborted).toBe(true)
    vi.useRealTimers()
  })

  it('should accept timeout', async () => {
    vi.useFakeTimers()
    const promiseFn = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('index'), 1000)))
    const { status } = useAsyncData(promiseFn, { timeout: 1 })
    expect(status.value).toBe('pending')
    await vi.waitFor(() => { // todo: advanceTimersToNextTimer is not working here (?)
      expect(status.value).toBe('error')
    })
    vi.useRealTimers()
  })

  it('should handle already-aborted signal', async () => {
    const controller = new AbortController()
    controller.abort(new DOMException('Already aborted', 'AbortError'))

    const promiseFn = vi.fn(() => {
      return new Promise(resolve => setTimeout(() => resolve('test'), 100))
    })

    const { execute, status } = useAsyncData('already-aborted-test', promiseFn, {
      immediate: false,
    })

    execute({ signal: controller.signal })
    await flushPromises()

    // When signal is already aborted, the handler execution is aborted
    // so handler might not be called, and status is immediately set to idle
    expect(status.value).toBe('idle')
  })

  it('should merge multiple abort signals', async () => {
    vi.useFakeTimers()
    const controller1 = new AbortController()

    let receivedSignal: AbortSignal | undefined
    const promiseFn = vi.fn((_, { signal }) => {
      receivedSignal = signal
      return new Promise(resolve => setTimeout(() => resolve('test'), 1000))
    })

    const { execute, status, error } = useAsyncData('test-merge', promiseFn, { immediate: false })

    execute({ signal: controller1.signal })
    expect(status.value).toBe('pending')

    // Abort via first controller
    controller1.abort(new Error('Aborted by controller1'))
    await flushPromises()

    // External abort results in error state (not idle), with AbortError
    expect(status.value).toBe('error')
    expect(error.value).toBeTruthy()
    expect(receivedSignal?.aborted).toBe(true)

    vi.useRealTimers()
  })

  it('should work when AbortSignal.reason is unavailable (older browsers)', async () => {
    vi.useFakeTimers()

    // Mock older AbortController without .reason property
    class OldAbortController {
      signal: any = {
        aborted: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }

      abort () {
        this.signal.aborted = true
        // No reason property in old browsers
      }
    }

    vi.stubGlobal('AbortController', OldAbortController)

    const promiseFn = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('test'), 1000)))

    const { clear, status } = useAsyncData(promiseFn)
    expect(status.value).toBe('pending')

    clear()
    await flushPromises()

    expect(status.value).toBe('idle')

    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('should handle abort during dedupe:defer', async () => {
    vi.useFakeTimers()
    let callCount = 0
    const promiseFn = vi.fn(() => new Promise(resolve => setTimeout(() => resolve(++callCount), 1000)))

    const { execute, clear, status } = useAsyncData(promiseFn, { dedupe: 'defer', immediate: false })

    execute()
    expect(status.value).toBe('pending')

    execute() // Should defer to existing request
    expect(promiseFn).toHaveBeenCalledTimes(1)

    clear() // Abort both
    await flushPromises()

    expect(status.value).toBe('idle')
    expect(callCount).toBe(0)

    vi.useRealTimers()
  })

  it('should handle abort during dedupe:cancel', async () => {
    vi.useFakeTimers()
    let abortedCount = 0
    const promiseFn = vi.fn((_, { signal }) => {
      signal.addEventListener('abort', () => abortedCount++)
      return new Promise(resolve => setTimeout(() => resolve('test'), 1000))
    })

    const { execute, status } = useAsyncData(promiseFn, { dedupe: 'cancel', immediate: false })

    execute()
    expect(status.value).toBe('pending')

    execute() // Should cancel previous and start new
    await flushPromises()

    expect(abortedCount).toBe(1) // First request was aborted
    expect(promiseFn).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })

  it('should accept signal in refresh()', async () => {
    const controller = new AbortController()

    const promiseFn = vi.fn(() => Promise.resolve('test'))

    const { refresh, status } = await useAsyncData('refresh-signal-test', promiseFn)
    expect(status.value).toBe('success')

    refresh({ signal: controller.signal })
    // Abort with DOMException to get idle state
    controller.abort(new DOMException('Aborted', 'AbortError'))
    await flushPromises()

    // AbortError causes idle state (not error)
    expect(status.value).toBe('idle')
  })

  it('should clear error when clearing after error', async () => {
    const { data, error, status, clear } = await useAsyncData(() => Promise.reject(new Error('test error')))

    expect(status.value).toBe('error')
    expect(error.value).toBeTruthy()

    clear()

    expect(data.value).toBeUndefined()
    expect(error.value).toBe(undefined)
    expect(status.value).toBe('idle')
  })

  it('should abort ongoing request when clearing', async () => {
    vi.useFakeTimers()
    let aborted = false

    const promiseFn = vi.fn((_, { signal }) => {
      signal.addEventListener('abort', () => { aborted = true })
      return new Promise(resolve => setTimeout(() => resolve('test'), 1000))
    })

    const { clear, status } = useAsyncData(promiseFn)
    expect(status.value).toBe('pending')

    clear()
    await flushPromises()

    expect(aborted).toBe(true)
    expect(status.value).toBe('idle')

    vi.useRealTimers()
  })
})
