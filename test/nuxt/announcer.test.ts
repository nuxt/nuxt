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
            h('button', { id: 'clear-title', onClick: () => useHead({ title: '' }) }),
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

  it('`useRouteAnnouncer` should not restore the title after the page title becomes empty', async () => {
    let announcer!: ReturnType<typeof useRouteAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useRouteAnnouncer()
        return () => h('div', [h(NuxtRouteAnnouncer), h(NuxtPage)])
      },
    })

    await navigateTo('/announcer-first')
    await waitForTitle('First Page')
    await vi.waitFor(() => expect(announcer.message.value).toBe('First Page'))

    announcer.polite('First Page')
    expect(announcer.message.value).toBe('')

    await el.get('#clear-title').trigger('click')
    await vi.waitFor(() => expect(document.title).toBe(''))
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(announcer.message.value).toBe('')

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

  it('keeps polite and assertive announcements in separate live regions', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })
    announcer.polite('Draft saved')
    announcer.assertive('Upload failed')
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('Draft saved')
    expect(el.get('[role="alert"]').text()).toBe('Upload failed')
    el.unmount()
  })

  it('updates the live region when the public message ref changes', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })
    announcer.message.value = 'Direct update'
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('Direct update')
    el.unmount()
  })

  it('keeps direct ref updates made before the component mounts', async () => {
    const el = await mountSuspended({
      setup () {
        const announcer = useAnnouncer()
        announcer.message.value = 'Ready before mount'
        return () => h(NuxtAnnouncer)
      },
    })
    expect(el.get('[role="status"]').text()).toBe('Ready before mount')
    el.unmount()
  })

  it('does not restore an old repeated message after a direct ref update', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })
    announcer.polite('Old')
    announcer.polite('Old')
    announcer.message.value = 'New'
    await new Promise(resolve => setTimeout(resolve, 150))
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('New')
    el.unmount()
  })

  it('does not copy an existing announcement when the politeness ref changes', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })
    announcer.polite('Draft saved')
    announcer.politeness.value = 'assertive'
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('Draft saved')
    expect(el.get('[role="alert"]').text()).toBe('')
    el.unmount()
  })

  it.each(['message-first', 'politeness-first'])('uses the final urgency for direct ref updates: %s', async (order) => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })
    if (order === 'message-first') {
      announcer.message.value = 'Upload failed'
      announcer.politeness.value = 'assertive'
    } else {
      announcer.politeness.value = 'assertive'
      announcer.message.value = 'Upload failed'
    }
    await flushPromises()
    expect(el.get('[role="alert"]').text()).toBe('Upload failed')
    expect(el.get('[role="status"]').text()).toBe('')
    el.unmount()
  })

  it('routes a direct message from off to the final urgency in the same tick', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer({ politeness: 'off' })
        return () => h(NuxtAnnouncer, { politeness: 'off' })
      },
    })
    announcer.message.value = 'Upload failed'
    announcer.politeness.value = 'assertive'
    await flushPromises()
    expect(el.get('[role="alert"]').text()).toBe('Upload failed')
    expect(el.get('[aria-live="off"]').text()).toBe('')
    el.unmount()
  })

  it('does not restore a queued direct update after set()', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })
    announcer.message.value = 'Old'
    announcer.polite('New')
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('New')
    el.unmount()
  })

  it('re-announces a direct update matching the target region', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })
    announcer.polite('Saved')
    announcer.assertive('Failed')
    await flushPromises()
    announcer.politeness.value = 'polite'
    announcer.message.value = 'Saved'
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('')
    await vi.waitFor(() => expect(el.get('[role="status"]').text()).toBe('Saved'))
    expect(el.get('[role="alert"]').text()).toBe('Failed')
    el.unmount()
  })

  it('cancels a repeated direct update when a newer message arrives', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })
    announcer.polite('Saved')
    announcer.assertive('Failed')
    await flushPromises()
    announcer.politeness.value = 'polite'
    announcer.message.value = 'Saved'
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('')
    announcer.message.value = 'Updated'
    await new Promise(resolve => setTimeout(resolve, 150))
    await flushPromises()
    expect(el.get('[role="status"]').text()).toBe('Updated')
    el.unmount()
  })

  it('cancels a repeated direct update on unmount', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })
    announcer.polite('Saved')
    announcer.assertive('Failed')
    await flushPromises()
    announcer.politeness.value = 'polite'
    announcer.message.value = 'Saved'
    await flushPromises()
    el.unmount()
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(announcer._regions.polite.value).toBe('')
  })

  it('keeps another region pending when the public refs are changed', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })
    announcer.polite('Saved')
    announcer.polite('Saved')
    announcer.politeness.value = 'assertive'
    announcer.message.value = 'Failed'
    await vi.waitFor(() => {
      expect(el.get('[role="status"]').text()).toBe('Saved')
      expect(el.get('[role="alert"]').text()).toBe('Failed')
    })
    el.unmount()
  })

  it('restores a repeated message without losing an announcement in the other region', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer)
      },
    })
    announcer.polite('Saved')
    announcer.polite('Saved')
    announcer.assertive('Failed')
    await flushPromises()
    expect(el.get('[role="alert"]').text()).toBe('Failed')
    await vi.waitFor(() => expect(el.get('[role="status"]').text()).toBe('Saved'))
    el.unmount()
  })

  it('renders custom slot content for each active region', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const el = await mountSuspended({
      setup () {
        announcer = useAnnouncer()
        return () => h(NuxtAnnouncer, null, { default: ({ message }: { message: string }) => h('strong', message) })
      },
    })
    expect(el.findAll('strong')).toHaveLength(1)
    expect(el.get('[role="status"] strong').text()).toBe('')
    announcer.polite('Saved')
    announcer.assertive('Failed')
    await flushPromises()
    expect(el.get('[role="status"] strong').text()).toBe('Saved')
    expect(el.get('[role="alert"] strong').text()).toBe('Failed')
    expect(el.findAll('strong')).toHaveLength(2)
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
    await vi.waitFor(() => {
      expect(el.get('[role="status"]').text()).toBe('Item saved')
      expect(messages).toEqual(['Item saved', '', 'Item saved'])
    })

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
    await vi.waitFor(() => {
      expect(el.get('[role="status"]').text()).toBe('Item saved')
      expect(messages).toEqual(['Item saved', '', 'Item saved'])
    })

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
