import { Suspense, defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ViewTransitionStage } from '#app/components/view-transition-stage'
import { claimPendingViewTransition, createPendingViewTransition, preparePendingViewTransition, supersedePendingViewTransition } from '#app/view-transitions'

describe('view transition stage', () => {
  it('keeps the stage claimed by the same page through the commit render', () => {
    const route = { fullPath: '/destination' } as any
    const session = createPendingViewTransition(route, { fullPath: '/' } as any, [])
    const nuxtApp = { _pendingViewTransition: session } as any
    const owner = {}

    expect(claimPendingViewTransition(nuxtApp, route, owner)).toBe(session)
    expect(session.status).toBe('claimed')

    session.status = 'committing'

    expect(claimPendingViewTransition(nuxtApp, route, owner)).toBe(session)
    expect(claimPendingViewTransition(nuxtApp, route, {})).toBeUndefined()
  })

  it('does not revive a cancelled session during preparation', () => {
    const session = createPendingViewTransition({ fullPath: '/destination' } as any, { fullPath: '/' } as any, [])
    supersedePendingViewTransition(session)

    preparePendingViewTransition(session)

    expect(session.status).toBe('cancelled')
  })

  it('prepares the destination before releasing the visible Suspense commit', async () => {
    let resolveDestination: () => void
    const destination = new Promise<void>((resolve) => { resolveDestination = resolve })
    const showDestination = ref(false)
    const session = createPendingViewTransition(
      { fullPath: '/destination' } as any,
      { fullPath: '/' } as any,
      [],
    )
    const startTransition = vi.fn()
    session.start = startTransition

    const Destination = defineComponent({
      async setup () {
        await destination
        return () => h('p', { 'data-testid': 'destination' }, 'Destination')
      },
    })
    const OldPage = defineComponent({
      setup () {
        const count = ref(0)
        return () => h('button', { onClick: () => { count.value++ } }, String(count.value))
      },
    })
    const App = defineComponent({
      setup () {
        return () => h(Suspense, null, {
          default: () => showDestination.value
            ? h(ViewTransitionStage, { key: 'destination', session }, { default: () => h(Destination) })
            : h(OldPage),
        })
      },
    })

    const wrapper = mount(App)
    await nextTick()
    expect(wrapper.get('button').text()).toBe('0')

    showDestination.value = true
    await nextTick()
    await nextTick()

    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button').text()).toBe('1')
    expect(wrapper.find('[data-testid="destination"]').exists()).toBe(false)

    resolveDestination!()
    await flushPromises()

    expect(startTransition).toHaveBeenCalledOnce()
    expect(wrapper.get('button').text()).toBe('1')
    expect(wrapper.find('[data-testid="destination"]').exists()).toBe(false)

    session.status = 'committing'
    session.resolveGate()
    await flushPromises()

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.get('[data-testid="destination"]').text()).toBe('Destination')
  })

  it('discards a pending destination when a newer navigation starts', async () => {
    let resolveSlow: () => void
    let resolveMedium: () => void
    const slowReady = new Promise<void>((resolve) => { resolveSlow = resolve })
    const mediumReady = new Promise<void>((resolve) => { resolveMedium = resolve })
    const slowSession = createPendingViewTransition({ fullPath: '/slow' } as any, { fullPath: '/' } as any, [])
    const mediumSession = createPendingViewTransition({ fullPath: '/medium' } as any, { fullPath: '/slow' } as any, [])
    slowSession.start = vi.fn()
    mediumSession.start = vi.fn()

    const SlowPage = defineComponent({
      async setup () {
        await slowReady
        return () => h('p', { 'data-testid': 'slow' }, 'Slow')
      },
    })
    const MediumPage = defineComponent({
      async setup () {
        await mediumReady
        return () => h('p', { 'data-testid': 'medium' }, 'Medium')
      },
    })
    const current = shallowRef<{ key: string, session: typeof slowSession, component: typeof SlowPage }>()
    const OldPage = defineComponent({ setup: () => () => h('p', { 'data-testid': 'old' }, 'Old') })
    const App = defineComponent({
      setup () {
        return () => h(Suspense, null, {
          default: () => current.value
            ? h(ViewTransitionStage, { key: current.value.key, session: current.value.session }, { default: () => h(current.value!.component) })
            : h(OldPage),
        })
      },
    })

    const wrapper = mount(App)
    await nextTick()

    current.value = { key: 'slow', session: slowSession, component: SlowPage }
    await flushPromises()
    expect(wrapper.get('[data-testid="old"]').text()).toBe('Old')

    supersedePendingViewTransition(slowSession)
    mediumSession.superseded = [slowSession]
    current.value = { key: 'medium', session: mediumSession, component: MediumPage }
    await flushPromises()

    resolveMedium!()
    await flushPromises()
    expect(mediumSession.start).toHaveBeenCalledOnce()
    expect(slowSession.start).not.toHaveBeenCalled()

    mediumSession.status = 'committing'
    mediumSession.resolveGate()
    await flushPromises()

    expect(wrapper.find('[data-testid="slow"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="medium"]').text()).toBe('Medium')

    resolveSlow!()
    await flushPromises()
    expect(wrapper.find('[data-testid="slow"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="medium"]').text()).toBe('Medium')
  })
})
