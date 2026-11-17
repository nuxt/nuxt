// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import type { App, Component } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { createLazyInteractionComponent } from '../src/components/runtime/lazy-hydrated-component'

vi.mock('#app/nuxt', () => ({ useNuxtApp: () => ({ hook: vi.fn() }) }))

let app: App | undefined

afterEach(() => {
  vi.useRealTimers()
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
})

async function mountDeferred (component: Component, html: string, interaction?: keyof HTMLElementEventMap) {
  let resolve!: (component: Component) => void
  const loader = vi.fn(() => new Promise<Component>((res) => { resolve = res }))
  const lazy = createLazyInteractionComponent('deferred', loader)
  document.body.innerHTML = `<div id="app">${html}</div>`
  app = createSSRApp({ render: () => h(lazy, { hydrateOnInteraction: interaction }) })
  app.mount('#app')
  await flushPromises()
  return {
    loader,
    hydrate: async () => {
      resolve(component)
      await flushPromises()
    },
  }
}

describe('interaction hydration', () => {
  it('coalesces pending input events for each target to its latest update', async () => {
    const values: string[] = []
    const onInput = vi.fn((event: Event) => { values.push((event.target as HTMLInputElement).value) })
    const component = defineComponent({ setup: () => () => h('input', { onInput }) })
    const { hydrate } = await mountDeferred(component, '<input>', 'input')
    const input = document.querySelector('input')!
    for (const value of ['a', 'ab', 'abc']) {
      input.value = value
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value.at(-1) }))
    }
    await flushPromises()
    await hydrate()
    expect(values).toEqual(['abc'])
    expect(onInput.mock.calls[0]![0]).toMatchObject({ data: 'c' })
  })

  it('bounds queued events when a component takes a long time to load', async () => {
    const onPointermove = vi.fn()
    const component = defineComponent({ setup: () => () => h('button', { onPointermove }, 'Move') })
    const { loader, hydrate } = await mountDeferred(component, '<button>Move</button>', 'pointermove')
    const target = document.querySelector('button')!
    for (let clientX = 0; clientX < 500; clientX++) {
      target.dispatchEvent(new MouseEvent('pointermove', { clientX }))
    }
    await flushPromises()
    await hydrate()
    expect(loader).toHaveBeenCalledOnce()
    expect(onPointermove).toHaveBeenCalledTimes(50)
    expect(onPointermove.mock.calls.map(([event]) => event.clientX)).toEqual(Array.from({ length: 50 }, (_, i) => i))
  })

  it('does not replay pointerenter after the pointer has left during loading', async () => {
    const onPointerenter = vi.fn()
    const onClick = vi.fn()
    const component = defineComponent({ setup: () => () => h('button', { onPointerenter, onClick }, 'Hover') })
    const { hydrate } = await mountDeferred(component, '<button>Hover</button>')
    const target = document.querySelector('button')!
    target.dispatchEvent(new Event('pointerenter'))
    target.dispatchEvent(new Event('pointerleave'))
    target.click()
    await flushPromises()
    await hydrate()
    expect(onPointerenter).not.toHaveBeenCalled()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('hydrates when a nested input receives keyboard focus', async () => {
    const onFocus = vi.fn()
    const component = defineComponent({ setup: () => () => h('div', [h('input', { onFocus })]) })
    const { loader, hydrate } = await mountDeferred(component, '<div><input></div>')
    document.querySelector('input')!.focus()
    await flushPromises()
    expect(loader).toHaveBeenCalledOnce()
    await hydrate()
    expect(onFocus).toHaveBeenCalledOnce()
  })

  it('does not replay focus after focus has left during loading', async () => {
    const onFocus = vi.fn()
    const component = defineComponent({ setup: () => () => h('div', [h('input', { onFocus })]) })
    const { loader, hydrate } = await mountDeferred(component, '<div><input></div>')
    const input = document.querySelector('input')!
    input.focus()
    input.blur()
    await flushPromises()
    expect(loader).toHaveBeenCalledOnce()
    await hydrate()
    expect(onFocus).not.toHaveBeenCalled()
  })

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

  it('does not deliver replayed interactions to ancestors', async () => {
    const onClick = vi.fn()
    const onParentClick = vi.fn()
    const counter = defineComponent({ setup: () => () => h('button', { onClick }, 'Click') })
    let resolve!: (component: Component) => void
    const loader = vi.fn(() => new Promise<Component>((res) => { resolve = res }))
    const lazy = createLazyInteractionComponent('counter', loader)
    document.body.innerHTML = '<div id="app"><div><button>Click</button></div></div>'
    app = createSSRApp({ render: () => h('div', { onClick: onParentClick }, [h(lazy)]) })
    app.mount('#app')
    await flushPromises()

    const target = document.querySelector('button')!
    target.click()
    target.click()
    await flushPromises()
    expect(onParentClick).toHaveBeenCalledTimes(2)

    resolve(counter)
    await flushPromises()
    expect(onClick).toHaveBeenCalledTimes(2)
    expect(onParentClick).toHaveBeenCalledTimes(2)

    vi.setSystemTime(Date.now() + 1000)
    target.click()
    expect(onClick).toHaveBeenCalledTimes(3)
    expect(onParentClick).toHaveBeenCalledTimes(3)
  })

  it('delivers events dispatched by replayed handlers to ancestors', async () => {
    const onParentClick = vi.fn()
    const component = defineComponent({
      setup: () => () => h('div', [
        h('button', { id: 'proxy', onClick: () => document.querySelector<HTMLButtonElement>('#target')!.click() }, 'Proxy'),
        h('button', { id: 'target' }, 'Target'),
      ]),
    })
    let resolve!: (component: Component) => void
    const loader = vi.fn(() => new Promise<Component>((res) => { resolve = res }))
    const lazy = createLazyInteractionComponent('proxy', loader)
    document.body.innerHTML = '<div id="app"><div><div><button id="proxy">Proxy</button><button id="target">Target</button></div></div></div>'
    app = createSSRApp({ render: () => h('div', { onClick: onParentClick }, [h(lazy)]) })
    app.mount('#app')
    await flushPromises()

    document.querySelector<HTMLButtonElement>('#proxy')!.click()
    await flushPromises()
    expect(onParentClick).toHaveBeenCalledTimes(1)

    resolve(component)
    await flushPromises()
    expect(onParentClick).toHaveBeenCalledTimes(2)
    expect(onParentClick.mock.calls[1]![0].target).toBe(document.querySelector('#target'))
  })

  it('replays interactions on fragment roots and respects custom triggers', async () => {
    const onClick = vi.fn()
    const component = defineComponent({
      setup: () => () => [h('button', { onClick }, 'First'), h('button', { onClick }, 'Second')],
    })
    const loader = vi.fn(() => Promise.resolve(component))
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
