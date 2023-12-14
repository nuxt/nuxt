import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createServerComponent } from '../../packages/nuxt/src/components/runtime/server-component'
import { createSimpleRemoteIslandProvider } from '../fixtures/remote-provider'
import NuxtIsland from '../../packages/nuxt/src/app/components/nuxt-island'

vi.mock('#build/nuxt.config.mjs', async (original) => {
  return {
    // @ts-expect-error virtual file
    ...(await original()),
    remoteComponentIslands: true
  }
})

vi.mock('vue', async (original) => {
  const vue = await original<typeof import('vue')>()
  return {
    ...vue,
    h: vi.fn(vue.h)
  }
})

describe('runtime server component', () => {
  it('expect no data-v- attrbutes #23051', () => {
    // @ts-expect-error mock
    vi.mocked(h).mockImplementation(() => null)

    // @ts-expect-error test setup
    createServerComponent('DummyName').setup!({
      lazy: false
    }, {
      attrs: {
        'data-v-123': '',
        test: 1
      },
      slots: {},
      emit: vi.fn(),
      expose: vi.fn()
    })()

    expect(h).toHaveBeenCalledOnce()
    if (!vi.mocked(h).mock.lastCall) { throw new Error('no last call') }
    expect(vi.mocked(h).mock.lastCall![1]?.props).toBeTypeOf('object')
    expect(vi.mocked(h).mock.lastCall![1]?.props).toMatchInlineSnapshot(`
      {
        "data-v-123": "",
        "test": 1,
      }
    `)
    vi.mocked(h).mockRestore()
  })

  it('expect remote island to be rendered', async () => {
    const server = createSimpleRemoteIslandProvider()

    const wrapper = await mountSuspended(NuxtIsland, {
      props: {
        name: 'Test',
        source: 'http://localhost:3001'
      }
    })

    expect(wrapper.html()).toMatchInlineSnapshot('"<div>hello world from another server</div>"')

    await server.close()
  })

  it('force refresh', async () => {
    let count = 0
    const stubFetch = vi.fn(() => {
      count++
      return {
        id: '123',
        html: `<div>${count}</div>`,
        state: {},
        head: {
          link: [],
          style: []
        },
        json() {
          return this
        }
      }
    })
    vi.stubGlobal('fetch', stubFetch)

    const component = await mountSuspended(createServerComponent('dummyName'))
    expect(fetch).toHaveBeenCalledOnce()

    expect(component.html()).toBe('<div>1</div>')

    await component.vm.$.exposed!.refresh()
    expect(fetch).toHaveBeenCalledTimes(2)
    await nextTick()
    expect(component.html()).toBe('<div>2</div>')
    vi.mocked(fetch).mockRestore()
  })
})
