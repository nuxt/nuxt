import { describe, expect, it } from 'vitest'
import type { ComponentOptions } from 'vue'
import { Suspense, defineComponent, h, toDisplayString, useAttrs } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, mount } from '@vue/test-utils'
import { createClientOnly } from '../../packages/nuxt/src/app/components/client-only'
import { createClientPage } from '../../packages/nuxt/dist/components/runtime/client-component'

const Client = defineComponent({
  name: 'TestClient',
  setup () {
    const attrs = useAttrs()
    return () => h('div', {}, toDisplayString(attrs))
  },
})

describe('createClient attribute inheritance', () => {
  it('should retrieve attributes with useAttrs()', async () => {
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
})

describe('client page', () => {
  it('Should be suspensed when out of hydration', async () => {
    let resolve
    const promise = new Promise((_resolve) => {
      resolve = _resolve
    })

    const comp = defineComponent({
      async setup () {
        await promise
        return () => h('div', { id: 'async' }, 'async resolved')
      },
    })

    const wrapper = mount({
      setup () {
        return () => h('div', {}, [
          h(Suspense, {}, {
            default: () => h(createClientPage(() => Promise.resolve(comp)), {}),
            fallback: () => h('div', { id: 'fallback' }, 'loading'),
          }),
        ])
      },
    })

    await flushPromises()
    expect(wrapper.find('#fallback').exists()).toBe(true)
    expect(wrapper.find('#async').exists()).toBe(false)

    resolve!()
    await flushPromises()
    expect(wrapper.find('#async').exists()).toBe(true)
    expect(wrapper.find('#fallback').exists()).toBe(false)
  })
})
