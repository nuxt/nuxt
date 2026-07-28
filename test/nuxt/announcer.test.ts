/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { NuxtAnnouncer, NuxtPage, NuxtRouteAnnouncer } from '#components'

describe('NuxtRouteAnnouncer', () => {
  let router: ReturnType<typeof useRouter>

  beforeEach(() => {
    router = useRouter()
    router.addRoute({
      name: 'announcer-first',
      path: '/announcer-first',
      component: defineComponent({
        setup () {
          useHead({ title: 'First Page' })
          return () => h('div', [
            h('button', { id: 'set-title', onClick: () => useHead({ title: 'Dynamically set title' }) }),
          ])
        },
      }),
    })
    router.addRoute({
      name: 'announcer-second',
      path: '/announcer-second',
      component: defineComponent({
        setup () {
          useHead({ title: 'Second Page' })
          return () => h('div', 'Second page content')
        },
      }),
    })
  })

  afterEach(() => {
    router.removeRoute('announcer-first')
    router.removeRoute('announcer-second')
  })

  async function waitForTitle (title: string) {
    await vi.waitFor(() => {
      if (!document.title.includes(title)) {
        throw new Error(`title is ${document.title}`)
      }
    })
    await flushPromises()
  }

  it('`useRouteAnnouncer` should change message on route change', async () => {
    const el = await mountSuspended({
      setup: () => () => h('div', [h(NuxtRouteAnnouncer), h(NuxtPage)]),
    })

    await navigateTo('/announcer-first')
    await waitForTitle('First Page')
    expect(el.get('[role="status"]').text()).toContain('First Page')
    expect(el.get('[role="status"]').attributes('aria-live')).toBe('polite')

    await navigateTo('/announcer-second')
    await waitForTitle('Second Page')
    expect(el.html()).toContain('Second page content')
    expect(el.get('[role="status"]').text()).toContain('Second Page')

    el.unmount()
  })

  it('`useRouteAnnouncer` should change message on dynamically changed title', async () => {
    const el = await mountSuspended({
      setup: () => () => h('div', [h(NuxtRouteAnnouncer), h(NuxtPage)]),
    })

    await navigateTo('/announcer-first')
    await waitForTitle('First Page')
    await el.get('#set-title').trigger('click')
    await waitForTitle('Dynamically set title')
    expect(el.get('[role="status"]').text()).toContain('Dynamically set title')

    el.unmount()
  })

  it('`useAnnouncer` should announce polite message', async () => {
    const el = await mountSuspended({
      setup () {
        const { polite } = useAnnouncer()
        return () => h('div', [
          h(NuxtAnnouncer),
          h('button', { 'data-testid': 'polite-button', 'onClick': () => polite('Polite announcement') }),
        ])
      },
    })

    await el.get('[data-testid="polite-button"]').trigger('click')
    await flushPromises()
    expect(el.get('[role="status"]').text()).toContain('Polite announcement')
    expect(el.get('[role="status"]').attributes('aria-live')).toBe('polite')

    el.unmount()
  })

  it('`useAnnouncer` should announce assertive message', async () => {
    const el = await mountSuspended({
      setup () {
        const { assertive } = useAnnouncer()
        return () => h('div', [
          h(NuxtAnnouncer),
          h('button', { 'data-testid': 'assertive-button', 'onClick': () => assertive('Assertive announcement') }),
        ])
      },
    })

    await el.get('[data-testid="assertive-button"]').trigger('click')
    await flushPromises()
    expect(el.get('[role="alert"]').text()).toContain('Assertive announcement')
    expect(el.get('[role="alert"]').attributes('aria-live')).toBe('assertive')

    el.unmount()
  })
})
