import { describe, expect, it } from 'vitest'
import type { ComponentOptions } from 'vue'
import { Suspense, createSSRApp, defineComponent, h, toDisplayString, useAttrs } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, mount } from '@vue/test-utils'

import { createClientOnly } from '../../packages/nuxt/src/app/components/client-only'
import { createClientPage } from '../../packages/nuxt/dist/components/runtime/client-component'
import { ClientOnly } from '#components'

describe('client pages', () => {
  it('should render without a wrapper', async () => {
    const { resolve, wrapper } = createWrappedClientPage()
    expect(wrapper.html()).toMatchInlineSnapshot(`
      "<div>
        <div id="fallback">loading</div>
      </div>"
    `)
    resolve()
    await flushPromises()
    expect(wrapper.html()).toMatchInlineSnapshot(`
      "<div>
        <div id="async">async resolved</div>
      </div>"
    `)
  })

  it('createClient should retrieve attributes with useAttrs()', () => {
    const wrapper = mount(createClientOnly(Client as ComponentOptions), {
      attrs: {
        id: 'client',
      },
    })

    expect(wrapper.html()).toMatchInlineSnapshot(`
      "<div id="client">{
        "id": "client"
        }</div>"
    `)
  })

  it('should be suspensed when out of hydration', async () => {
    const { resolve, wrapper } = createWrappedClientPage()

    await flushPromises()
    expect(wrapper.find('#fallback').exists()).toBe(true)
    expect(wrapper.find('#async').exists()).toBe(false)

    resolve!()
    await flushPromises()
    expect(wrapper.find('#async').exists()).toBe(true)
    expect(wrapper.find('#fallback').exists()).toBe(false)
  })
})

describe('client-only', () => {
  it('should render its children', async () => {
    const component = defineComponent({
      setup () {
        return () => h(ClientOnly, {}, {
          default: () => h('div', {}, 'client-only'),
        })
      },
    })
    const wrapper = await mountSuspended(component)
    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>client-only</div>"`)
  })

  it('should support inherited attributes', async () => {
    const component = defineComponent({
      setup () {
        return () => h(ClientOnly, { class: 'test', id: 'test' }, {
          default: () => h('div', {}, 'client-only'),
        })
      },
    })
    const wrapper = await mountSuspended(component)
    expect(wrapper.html()).toMatchInlineSnapshot(`"<div class="test" id="test">client-only</div>"`)
  })
})

describe('client-only SSR fallback tag', () => {
  const renderFallback = (props: Record<string, unknown>) => {
    const app = createSSRApp(defineComponent({
      setup: () => () => h(ClientOnly, props, { default: () => [] }),
    }))
    return renderToString(app)
  }

  it('renders a valid `fallbackTag` verbatim', async () => {
    expect(await renderFallback({ fallbackTag: 'div', fallback: 'x' })).toBe('<div>x</div>')
    expect(await renderFallback({ fallbackTag: 'section', fallback: 'x' })).toBe('<section>x</section>')
    expect(await renderFallback({ fallbackTag: 'my-element', fallback: 'x' })).toBe('<my-element>x</my-element>')
  })

  it('replaces a malicious `fallbackTag` with `span`', async () => {
    expect(await renderFallback({ fallbackTag: 'img src=x onerror=alert(1)', fallback: 'x' })).toBe('<span>x</span>')
    expect(await renderFallback({ fallbackTag: '<script>', fallback: 'x' })).toBe('<span>x</span>')
  })

  it('falls back to `span` when `fallbackTag` is empty or undefined', async () => {
    expect(await renderFallback({ fallback: 'x' })).toBe('<span>x</span>')
    expect(await renderFallback({ fallbackTag: '', fallback: 'x' })).toBe('<span>x</span>')
  })

  it('also sanitises `placeholderTag`', async () => {
    expect(await renderFallback({ placeholderTag: 'aside', placeholder: 'x' })).toBe('<aside>x</aside>')
    expect(await renderFallback({ placeholderTag: 'img src=x onerror=alert(1)', placeholder: 'x' })).toBe('<span>x</span>')
  })
})

describe('createClientOnly', () => {
  it('should not inherit attributes if disabled', async () => {
    const NonInherited = createClientOnly({
      inheritAttrs: false,
      setup: () => () => h('div', 'foo'),
    })
    const component = defineComponent({
      setup () {
        return () => h(NonInherited, { class: 'test', id: 'test' })
      },
    })
    const wrapper = await mountSuspended(component)
    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>foo</div>"`)
  })
})

const Client = defineComponent({
  name: 'TestClient',
  setup () {
    const attrs = useAttrs()
    return () => h('div', {}, toDisplayString(attrs))
  },
})

function createWrappedClientPage () {
  let resolve: () => void
  const promise = new Promise<void>((_resolve) => {
    resolve = _resolve
  })

  const comp = defineComponent({
    async setup () {
      await promise
      return () => h('div', { id: 'async' }, 'async resolved')
    },
  })

  const ClientPage = defineAsyncComponent(() => createClientPage(() => Promise.resolve(comp)))

  const wrapper = mount({
    setup () {
      return () => h('div', {}, [
        h(Suspense, {}, {
          default: () => h(ClientPage, {}),
          fallback: () => h('div', { id: 'fallback' }, 'loading'),
        }),
      ])
    },
  })

  return { resolve: resolve!, wrapper }
}
