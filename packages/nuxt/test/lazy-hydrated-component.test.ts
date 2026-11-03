// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import type { App, Component } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { createLazyInteractionComponent } from '../src/components/runtime/lazy-hydrated-component'

vi.mock('#app/nuxt', () => ({ useNuxtApp: () => ({ hook: vi.fn() }) }))

let app: App | undefined

afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
})

describe('interaction hydration', () => {
  it.each([
    ['default', undefined, 'click'],
    ['array', ['click'], 'click'],
    ['click', 'click', 'click'],
    ['touch', ['touchstart'], 'touchstart'],
  ] satisfies Array<[string, keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | undefined, keyof HTMLElementEventMap]>)('replays the first %s interaction after the component loads', async (_, interaction, eventType) => {
    const onInteraction = vi.fn()
    const counter = defineComponent({
      setup () {
        const count = ref(0)
        return () => h('button', {
          onClick: (event: Event) => { onInteraction(event); count.value++ },
          onTouchstart: (event: Event) => { onInteraction(event); count.value++ },
        }, [h('span', `Clicked ${count.value}`)])
      },
    })
    let resolve!: (component: Component) => void
    const loader = vi.fn(() => new Promise<Component>((res) => { resolve = res }))
    const lazy = createLazyInteractionComponent('counter', loader)
    const onHydrated = vi.fn()
    document.body.innerHTML = '<div id="app"><button><span>Clicked 0</span></button></div>'
    app = createSSRApp({ render: () => h(lazy, { hydrateOnInteraction: interaction, onHydrated }) })
    app.mount('#app')
    await flushPromises()

    expect(loader).not.toHaveBeenCalled()
    const target = document.querySelector('span')!
    target.dispatchEvent(new Event(eventType, { bubbles: true }))
    await flushPromises()
    expect(loader).toHaveBeenCalledOnce()
    expect(onInteraction).not.toHaveBeenCalled()

    resolve(counter)
    await flushPromises()
    await nextTick()

    expect(onHydrated).toHaveBeenCalledOnce()
    expect(onInteraction).toHaveBeenCalledOnce()
    expect(onInteraction.mock.calls[0]![0].target).toBe(target)
    expect(target.textContent).toBe('Clicked 1')

    target.dispatchEvent(new Event(eventType, { bubbles: true }))
    await nextTick()
    expect(onInteraction).toHaveBeenCalledTimes(2)
    expect(target.textContent).toBe('Clicked 2')

    app.unmount()
    document.body.innerHTML = '<div id="app"><button><span>Clicked 0</span></button></div>'
    onInteraction.mockClear()
    app = createSSRApp({ render: () => h(lazy, { hydrateOnInteraction: interaction }) })
    app.mount('#app')
    await flushPromises()

    const cachedTarget = document.querySelector('span')!
    cachedTarget.dispatchEvent(new Event(eventType, { bubbles: true }))
    await flushPromises()
    expect(loader).toHaveBeenCalledOnce()
    expect(onInteraction).toHaveBeenCalledOnce()
    expect(cachedTarget.textContent).toBe('Clicked 1')
  })

  it('preserves clicks while a preceding pointer interaction loads the component', async () => {
    const onClick = vi.fn()
    const counter = defineComponent({ setup: () => () => h('button', { onClick }, 'Click') })
    let resolve!: (component: Component) => void
    const loader = vi.fn(() => new Promise<Component>((res) => { resolve = res }))
    const lazy = createLazyInteractionComponent('counter', loader)
    document.body.innerHTML = '<div id="app"><button>Click</button></div>'
    app = createSSRApp({ render: () => h(lazy) })
    app.mount('#app')
    await flushPromises()

    const target = document.querySelector('button')!
    target.dispatchEvent(new Event('pointerenter'))
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    await flushPromises()
    expect(onClick).not.toHaveBeenCalled()

    resolve(counter)
    await flushPromises()
    expect(loader).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledTimes(2)
    expect(onClick.mock.calls[0]![0]).toMatchObject({ ctrlKey: true, target })
    expect(onClick.mock.calls[1]![0]).toMatchObject({ shiftKey: true, target })
  })

  it('replays interactions on fragment roots and respects custom triggers', async () => {
    const onClick = vi.fn()
    const component = defineComponent({
      setup: () => () => [h('button', { onClick }, 'First'), h('button', { onClick }, 'Second')],
    })
    const loader = vi.fn(async () => component)
    const lazy = createLazyInteractionComponent('fragment', loader)
    document.body.innerHTML = '<div id="app"><!--[--><button>First</button><button>Second</button><!--]--></div>'
    app = createSSRApp({ render: () => h(lazy, { hydrateOnInteraction: 'click' }) })
    app.mount('#app')
    await flushPromises()

    const [first, second] = document.querySelectorAll('button')
    second!.dispatchEvent(new Event('pointerenter'))
    await flushPromises()
    expect(loader).not.toHaveBeenCalled()

    second!.click()
    await flushPromises()
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick.mock.calls[0]![0].target).toBe(second)

    first!.click()
    await nextTick()
    expect(onClick).toHaveBeenCalledTimes(2)
    expect(onClick.mock.calls[1]![0].target).toBe(first)
  })

  it.each([false, true])('cleans up interactions when unmounted with loading started: %s', async (startLoading) => {
    const onClick = vi.fn()
    const counter = defineComponent({ setup: () => () => h('button', { onClick }, 'Click') })
    let resolve!: (component: Component) => void
    const loader = vi.fn(() => new Promise<Component>((res) => { resolve = res }))
    const lazy = createLazyInteractionComponent('counter', loader)
    const onHydrated = vi.fn()
    document.body.innerHTML = '<div id="app"><button>Click</button></div>'
    app = createSSRApp({ render: () => h(lazy, { onHydrated }) })
    app.mount('#app')
    await flushPromises()
    const target = document.querySelector('button')!

    if (startLoading) {
      target.click()
      await flushPromises()
    }
    app.unmount()
    app = undefined
    target.click()

    if (startLoading) {
      resolve(counter)
      await flushPromises()
      expect(loader).toHaveBeenCalledOnce()
    } else {
      expect(loader).not.toHaveBeenCalled()
    }
    expect(onClick).not.toHaveBeenCalled()
    expect(onHydrated).not.toHaveBeenCalled()
  })
})
