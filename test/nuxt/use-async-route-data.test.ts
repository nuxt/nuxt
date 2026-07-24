/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import { clearNuxtData, useNuxtData } from '#app/composables/asyncData'
import { createRouteAsyncDataKey, useAsyncRouteData } from '#app/composables/asyncRouteData'
import { navigateTo, useRoute } from '#app/composables/router'
import * as ssr from '#app/composables/ssr'

describe('createRouteAsyncDataKey', () => {
  it('builds a flat composite key from path and user key', () => {
    expect(createRouteAsyncDataKey('/posts/1', 'article')).toBe(`$r:${encodeURIComponent('/posts/1')}:article`)
    expect(createRouteAsyncDataKey('/', 'home')).toBe(`$r:${encodeURIComponent('/')}:home`)
  })

  it('does not collide for slash vs hyphen paths or case variants', () => {
    expect(createRouteAsyncDataKey('/foo/bar', 'x')).not.toBe(createRouteAsyncDataKey('/foo-bar', 'x'))
    expect(createRouteAsyncDataKey('/Foo', 'x')).not.toBe(createRouteAsyncDataKey('/foo', 'x'))
  })
})

describe('useAsyncRouteData', () => {
  let uniqueKey: string
  let counter = 0

  beforeEach(() => {
    uniqueKey = `route-key-${++counter}`
    clearNuxtData()
  })

  it('passes the current route into the handler', async () => {
    const route = useRoute()
    const handler = vi.fn((r: ReturnType<typeof useRoute>) => Promise.resolve({ path: r.path }))

    const { data } = await useAsyncRouteData(uniqueKey, handler)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![0].path).toBe(route.path)
    expect(data.value).toEqual({ path: route.path })
  })

  it('stores data under a route-scoped flat payload key', async () => {
    const route = useRoute()
    const compositeKey = createRouteAsyncDataKey(route.path, uniqueKey)

    await useAsyncRouteData(uniqueKey, () => Promise.resolve('payload-value'))

    expect(useNuxtApp().payload.data[compositeKey]).toBe('payload-value')
    expect(useNuxtData(compositeKey).data.value).toBe('payload-value')
  })

  it('migrates the cache slot when the route path changes', async () => {
    const handler = vi.fn((route: ReturnType<typeof useRoute>) => Promise.resolve(route.path))

    const component = defineComponent({
      setup () {
        const { data } = useAsyncRouteData(uniqueKey, handler)
        return () => h('div', [data.value])
      },
    })

    const comp = await mountSuspended(component)
    expect(handler).toHaveBeenCalledTimes(1)
    const firstPath = useRoute().path
    expect(comp.text()).toBe(firstPath)
    expect(useNuxtApp().payload.data[createRouteAsyncDataKey(firstPath, uniqueKey)]).toBe(firstPath)

    await navigateTo('/about')
    await flushPromises()

    expect(handler).toHaveBeenCalledTimes(2)
    expect(useRoute().path).toBe('/about')
    expect(comp.text()).toBe('/about')
    expect(createRouteAsyncDataKey('/about', uniqueKey)).not.toBe(createRouteAsyncDataKey(firstPath, uniqueKey))
    expect(useNuxtApp().payload.data[createRouteAsyncDataKey('/about', uniqueKey)]).toBe('/about')

    comp.unmount()
  })

  it('does not re-run when only the query string changes', async () => {
    const handler = vi.fn((route: ReturnType<typeof useRoute>) => Promise.resolve(route.fullPath))

    const component = defineComponent({
      setup () {
        const { data } = useAsyncRouteData(uniqueKey, handler)
        return () => h('div', [data.value])
      },
    })

    const comp = await mountSuspended(component)
    expect(handler).toHaveBeenCalledTimes(1)

    await navigateTo({ path: useRoute().path, query: { page: '2' } })
    await flushPromises()

    expect(handler).toHaveBeenCalledTimes(1)
    comp.unmount()
  })

  it('sets a 404 error when validate returns false', async () => {
    const setStatus = vi.spyOn(ssr, 'setResponseStatus')
    const route = useRoute()
    const validate = vi.fn(() => false)

    const { data, error, status } = await useAsyncRouteData(
      uniqueKey,
      () => Promise.resolve({ ok: false }),
      {
        validate,
        default: () => null,
      },
    )

    expect(validate).toHaveBeenCalledWith({ ok: false }, route)
    expect(data.value).toBe(null)
    expect(status.value).toBe('error')
    expect(error.value?.status).toBe(404)
    if (import.meta.server) {
      expect(setStatus).toHaveBeenCalledWith(
        expect.anything(),
        404,
        expect.stringContaining('Page Not Found'),
      )
    }
    setStatus.mockRestore()
  })

  it('accepts custom status from validate result object', async () => {
    const { error, status } = await useAsyncRouteData(
      uniqueKey,
      () => Promise.resolve({ ok: false }),
      {
        validate: () => ({ status: 410, statusText: 'Gone' }),
        default: () => null,
      },
    )

    expect(status.value).toBe('error')
    expect(error.value?.status).toBe(410)
    expect(error.value?.statusText).toBe('Gone')
  })

  it('supports lazy: true without a separate lazy composable', async () => {
    let resolve!: (value: string) => void
    const promise = new Promise<string>((r) => { resolve = r })

    const res = useAsyncRouteData(uniqueKey, () => promise, { lazy: true })
    expect(res.status.value).toBe('pending')
    expect(res.data.value).toBe(undefined)

    resolve('lazy-ok')
    await res
    expect(res.data.value).toBe('lazy-ok')
    expect(res.status.value).toBe('success')
  })

  it('clear removes the route-scoped slot', async () => {
    const route = useRoute()
    const compositeKey = createRouteAsyncDataKey(route.path, uniqueKey)
    const { clear } = await useAsyncRouteData(uniqueKey, () => Promise.resolve('to-clear'))

    expect(useNuxtApp().payload.data[compositeKey]).toBe('to-clear')
    clear()
    expect(useNuxtApp().payload.data[compositeKey]).toBeUndefined()
  })
})
