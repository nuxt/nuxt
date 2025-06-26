/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { NuxtLayout, NuxtPage } from '#components'

describe.skipIf(process.env.NUXT_LEGACY !== '1')('NuxtPage should work with keepalive options', () => {
  let visits = 0
  const router = useRouter()
  beforeEach(() => {
    visits = 0
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
  })
  afterEach(() => {
    router.removeRoute('home')
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
})
