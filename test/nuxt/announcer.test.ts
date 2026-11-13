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
            h('button', { id: 'set-meta', onClick: () => useHead({ meta: [{ name: 'description', content: 'Unrelated' }] }) }),
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

  it('`useRouteAnnouncer` should not re-announce an unchanged title when other head tags change', async () => {
    const messages: string[] = []
    const el = await mountSuspended({
      setup () {
        const { message } = useRouteAnnouncer()
        watch(message, value => messages.push(value), { flush: 'sync' })
        return () => h('div', [h(NuxtRouteAnnouncer), h(NuxtPage)])
      },
    })

    await navigateTo('/announcer-first')
    await waitForTitle('First Page')
    messages.length = 0

    await el.get('#set-meta').trigger('click')
    await vi.waitFor(() => expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Unrelated'))
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(messages).toEqual([])

    el.unmount()
  })

  it('`useRouteAnnouncer` should cancel a pending repeat on unmount', async () => {
    let announcer!: ReturnType<typeof useRouteAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useRouteAnnouncer()
        return () => h(NuxtRouteAnnouncer)
      },
    })

    announcer.polite('Item saved')
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('Item saved')

    announcer.polite('Item saved')
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('')

    el.unmount()
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(announcer.message.value).toBe('')
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

  it('`useAnnouncer` should re-announce an identical consecutive message', async () => {
    const messages: string[] = []
    const el = await mountSuspended({
      setup () {
        const { polite, message } = useAnnouncer()
        watch(message, value => messages.push(value), { flush: 'sync' })
        return () => h('div', [
          h(NuxtAnnouncer),
          h('button', { 'data-testid': 'polite-button', 'onClick': () => polite('Item saved') }),
        ])
      },
    })

    await el.get('[data-testid="polite-button"]').trigger('click')
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('Item saved')

    await el.get('[data-testid="polite-button"]').trigger('click')
    expect(el.get('[role="status"]').text()).toBe('')
    await vi.waitFor(() => expect(el.get('[role="status"]').text()).toBe('Item saved'))

    expect(messages).toEqual(['Item saved', '', 'Item saved'])

    el.unmount()
  })

  it('`useAnnouncer` should re-announce an identical message repeated before restoration', async () => {
    const messages: string[] = []
    const el = await mountSuspended({
      setup () {
        const { polite, message } = useAnnouncer()
        watch(message, value => messages.push(value), { flush: 'sync' })
        return () => h('div', [
          h(NuxtAnnouncer),
          h('button', { 'data-testid': 'repeat-button', 'onClick': () => polite('Item saved') }),
        ])
      },
    })

    const button = el.get('[data-testid="repeat-button"]')

    await button.trigger('click')
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('Item saved')

    await button.trigger('click')
    await button.trigger('click')
    expect(el.get('[role="status"]').text()).toBe('')
    await vi.waitFor(() => expect(el.get('[role="status"]').text()).toBe('Item saved'))

    expect(messages).toEqual(['Item saved', '', 'Item saved'])

    el.unmount()
  })

  it('`useAnnouncer` should cancel a pending repeat on unmount', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })

    announcer.polite('Item saved')
    await flushPromises()
    expect(announcer.message.value).toBe('Item saved')

    announcer.polite('Item saved')
    await flushPromises()
    expect(announcer.message.value).toBe('')

    el.unmount()
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(announcer.message.value).toBe('')
  })

  it('`useAnnouncer` should not restore a superseded message', async () => {
    const messages: string[] = []
    const el = await mountSuspended({
      setup () {
        const { polite, message } = useAnnouncer()
        watch(message, value => messages.push(value), { flush: 'sync' })
        return () => h('div', [
          h(NuxtAnnouncer),
          h('button', { 'data-testid': 'repeat-button', 'onClick': () => polite('First') }),
          h('button', { 'data-testid': 'other-button', 'onClick': () => polite('Second') }),
        ])
      },
    })

    await el.get('[data-testid="repeat-button"]').trigger('click')
    await el.get('[data-testid="repeat-button"]').trigger('click')
    await el.get('[data-testid="other-button"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(el.get('[role="status"]').text()).toBe('Second')
    expect(messages).toEqual(['First', '', 'Second'])

    el.unmount()
  })
})
