import { describe, expect, it } from 'vitest'
import type { ComponentOptions } from 'vue'
import { Suspense, defineComponent, h, toDisplayString, useAttrs } from 'vue'
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
