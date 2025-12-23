/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { NuxtLayout, NuxtPage } from '#components'

describe('NuxtPage should work with keepalive options', () => {
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

describe('Route validation with history state', () => {
  const router = useRouter()

  beforeEach(() => {
    router.addRoute({
      name: 'valid-page',
      path: '/valid-page',
      component: defineComponent({
        name: 'valid-page',
        setup () {
          return () => h('div', 'Valid Page')
        },
      }),
    })

    router.addRoute({
      name: 'forbidden-page',
      path: '/forbidden-page',
      meta: {
        validate: route => route.path !== '/forbidden-page',
      },
      component: defineComponent({
        name: 'forbidden-page',
        setup () {
          return () => h('div', 'Forbidden Page')
        },
      }),
    })
  })

  afterEach(() => {
    router.removeRoute('valid-page')
    router.removeRoute('forbidden-page')
  })

  it('should push `to` route to history when validation fails (PR #33942)', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage) })
      },
    })

    await navigateTo('/valid-page')
    await nextTick()

    const pushStateSpy = vi.spyOn(window.history, 'pushState')

    // Attempt to navigate to a route that will fail validation
    // The validate middleware will catch this and push history with to.fullPath
    try {
      await navigateTo('/forbidden-page')
      await nextTick()
    } catch (error: any) {
      // Expected to throw an error due to validation failure
      expect(error.statusCode).toBe(404)
    }

    expect(pushStateSpy).toHaveBeenCalled()
    expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/forbidden-page')

    pushStateSpy.mockRestore()
    el.unmount()
  })
})
