/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { NuxtLayout, NuxtPage } from '#components'
import layouts from '#build/layouts.mjs'
import { useRoute } from '#app/composables/router'

describe('NuxtLayout nested layout route sync (#32904)', () => {
  let router: ReturnType<typeof useRouter>
  let resolveDeferredPage: () => void
  let el: VueWrapper

  const addedLayouts = ['x-full', 'x-default', 'x-secondary']
  const addedPages = ['x-a', 'x-b']

  beforeAll(async () => {
    router = useRouter()

    layouts['x-full'] = defineComponent({
      setup (_, ctx) {
        const route = useRoute()
        return () => h('div', {}, [
          h('span', { 'data-testid': 'full-route' }, String(route.name)),
          ...ctx.slots.default?.() || [],
        ])
      },
    })

    layouts['x-default'] = defineComponent({
      setup (_, ctx) {
        const route = useRoute()
        return () => h(NuxtLayout, { name: 'x-full' }, {
          default: () => [
            h('span', { 'data-testid': 'default-route' }, String(route.name)),
            ...ctx.slots.default?.() || [],
          ],
        })
      },
    })

    layouts['x-secondary'] = defineComponent({
      setup (_, ctx) {
        const route = useRoute()
        return () => h('div', {}, [
          h('span', { 'data-testid': 'secondary-route' }, String(route.name)),
          ...ctx.slots.default?.() || [],
        ])
      },
    })

    router.addRoute({
      name: 'x-a',
      path: '/x-a',
      // @ts-expect-error dynamically-added layout is not typed
      meta: { layout: 'x-default' },
      component: defineComponent({
        setup () {
          return () => h('div', { 'data-testid': 'page-a' }, 'A')
        },
      }),
    })

    router.addRoute({
      name: 'x-b',
      path: '/x-b',
      // @ts-expect-error dynamically-added layout is not typed
      meta: { layout: 'x-secondary' },
      component: defineComponent({
        async setup () {
          await new Promise<void>((resolve) => {
            resolveDeferredPage = resolve
          })
          return () => h('div', { 'data-testid': 'page-b' }, 'B')
        },
      }),
    })

    el = await mountSuspended({ setup: () => () => h(NuxtLayout, {}, { default: () => h(NuxtPage) }) })
  })

  afterAll(() => {
    el.unmount()
    for (const layout of addedLayouts) {
      delete layouts[layout]
    }
    for (const page of addedPages) {
      router.removeRoute(page)
    }
  })

  it('does not update inner nested layout route before the suspended destination page resolves', async () => {
    const nuxtApp = useNuxtApp()

    await navigateTo('/x-a')
    await flushPromises()

    expect.soft(el.get('[data-testid="full-route"]').text()).toBe('x-a')
    expect.soft(el.get('[data-testid="default-route"]').text()).toBe('x-a')

    await navigateTo('/x-b')
    await flushPromises()

    expect.soft(el.get('[data-testid="default-route"]').text()).toBe('x-a')
    expect.soft(el.get('[data-testid="page-a"]').text()).toBe('A')
    expect(el.get('[data-testid="full-route"]').text()).toBe('x-a')

    resolveDeferredPage()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()

    expect.soft(el.get('[data-testid="secondary-route"]').text()).toBe('x-b')
    expect.soft(el.get('[data-testid="page-b"]').text()).toBe('B')
  })
})
