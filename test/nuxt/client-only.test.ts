import { describe, expect, it, vi } from 'vitest'
import type { ComponentOptions } from 'vue'
import { Suspense, defineComponent, h, toDisplayString, useAttrs } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, mount } from '@vue/test-utils'

import { createClientOnly } from '../../packages/nuxt/src/app/components/client-only'
import { createClientPage } from '../../packages/nuxt/dist/components/runtime/client-component'

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

  it('createClient should retrieve attributes with useAttrs()', async () => {
    const wrapper = await mountSuspended(createClientOnly(Client as ComponentOptions), {
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

describe('app/compat', () => {
  const Component = defineComponent({
    setup () {
      const visible = ref(false)
      setInterval(() => {
        visible.value = true
      }, 1000)

      return () => h('div', {}, visible.value ? h('span', { id: 'child' }) : {})
    },
  })
  it('setInterval is not auto-imported', async () => {
    vi.useFakeTimers()

    const wrapper = mount(Component)

    vi.advanceTimersByTime(1000)

    await wrapper.vm.$nextTick()

    expect(wrapper.find('#child').exists()).toBe(true)

    vi.useRealTimers()
  })
})
