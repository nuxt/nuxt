/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { NuxtLayout, NuxtPage } from '#components'
import layouts from '#build/layouts.mjs'

describe('NuxtPage should work with keepalive options', () => {
  let visits = 0
  const router = useRouter()
  beforeEach(() => {
    visits = 0
    layouts.other = defineComponent({
      setup (_, ctx) {
        return () => h('div', ctx.slots.default?.())
      },
    })
    router.addRoute({
      name: 'home',
      path: '/home',
      component: defineComponent({
        name: 'home',
        setup () {
          visits++
          return () => h('div', 'home')
        },
      }),
    })
    router.addRoute({
      name: 'other',
      path: '/other',
      meta: { layout: 'other' },
      component: defineComponent({
        name: 'other',
        setup () {
          return () => h('div', 'other')
        },
      }),
    })
  })
  afterEach(() => {
    router.removeRoute('home')
    router.removeRoute('other')
    delete layouts.other
  })
  // include/exclude/boolean
  it('should reload setup every time a page is visited, without keepalive', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage) })
      },
    })
    await navigateTo('/home')
    await navigateTo('/')
    await navigateTo('/home')
    expect(visits).toBe(2)
    el.unmount()
  })

  it('should not remount a page when keepalive is enabled', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage, { keepalive: true }) })
      },
    })
    await navigateTo('/home')
    await navigateTo('/')
    await navigateTo('/home')
    expect(visits).toBe(1)
    el.unmount()
  })

  it('should not remount a page when keepalive is granularly enabled (with include)', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage, { keepalive: { include: ['home'] } }) })
      },
    })
    await navigateTo('/home')
    await navigateTo('/')
    await navigateTo('/home')
    expect(visits).toBe(1)
    el.unmount()
  })

  it('should not remount a page when keepalive is granularly enabled (with exclude)', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage, { keepalive: { exclude: ['catchall'] } }) })
      },
    })
    await navigateTo('/home')
    await navigateTo('/')
    await navigateTo('/home')
    expect(visits).toBe(1)
    el.unmount()
  })

  it('should not remount a page when keepalive options are modified', async () => {
    const pages = ref('home')
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage, { keepalive: { include: pages.value } }) })
      },
    })
    await navigateTo('/home')
    await navigateTo('/')
    await navigateTo('/home')
    pages.value = 'home,catchall'
    await navigateTo('/')
    await navigateTo('/home')
    expect(visits).toBe(1)
    el.unmount()
  })

  it('should preserve keepalive when layout changes', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage, { keepalive: true }) })
      },
    })
    await navigateTo('/home')
    await navigateTo('/other')
    await navigateTo('/home')
    expect(visits).toBe(1)
    el.unmount()
  })
})
