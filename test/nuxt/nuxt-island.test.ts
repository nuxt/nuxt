import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { h } from 'vue'
import { mountSuspended } from 'nuxt-vitest/utils'
import { createServerComponent } from '../../packages/nuxt/src/components/runtime/server-component'
import { createSimpleRemoteIslandProvider } from '../fixtures/remote-provider'
import NuxtIsland from '../../packages/nuxt/src/app/components/nuxt-island'
import { flushPromises } from '@vue/test-utils'
import { useNuxtApp } from '../../packages/nuxt/src/app'

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

beforeEach(() => {
  vi.mocked(h).mockClear()
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


  describe('Cache control', () => {
    beforeEach(() => {
      let count = 0
      const ogFetch = fetch
      const stubFetch = vi.fn((...args: Parameters<typeof fetch>) => {
        const [url] = args

        if (typeof url === 'string' && url.startsWith('/__nuxt_island')) {
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
        }
        return ogFetch(...args)
      })
      vi.stubGlobal('fetch', stubFetch)

      useNuxtApp().payload.data = {}
    })

    afterEach(() => {
      vi.mocked(fetch).mockRestore()
    })

    it('expect to not use cached payload', async () => {
      const wrapper = await mountSuspended(
        createServerComponent('CacheTest'), {
        props: {
          useCache: false,
          props: {
            test: 1
          }
        }
      })

      expect(fetch).toHaveBeenCalledOnce()
      expect(wrapper.html()).toMatchInlineSnapshot('"<div>1</div>"')
      await wrapper.setProps({
        useCache: false,
        props: {
          test: 2
        }
      })

      await flushPromises()
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(wrapper.html()).toMatchInlineSnapshot('"<div>2</div>"')
      await wrapper.setProps({
        useCache: false,
        props: {
          test: 1
        }
      })
      await flushPromises()
      // NuxtIsland should fetch again, because the cache is not used
      expect(fetch).toHaveBeenCalledTimes(3)
      expect(wrapper.html()).toMatchInlineSnapshot('"<div>3</div>"')
    })

    it('expect to use cached payload', async () => {
      const wrapper = await mountSuspended(
        createServerComponent('CacheTest'), {
        props: {
          useCache: true,
          props: {
            test: 1
          }
        }
      })

      expect(fetch).toHaveBeenCalledOnce()
      expect(wrapper.html()).toMatchInlineSnapshot('"<div>1</div>"')
      await wrapper.setProps({
        useCache: true,
        props: {
          test: 2
        }
      })

      await flushPromises()
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(wrapper.html()).toMatchInlineSnapshot('"<div>2</div>"')
      await wrapper.setProps({
        useCache: true,
        props: {
          test: 2
        }
      })
      await flushPromises()
      // should not fetch the component, because the cache is used
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(wrapper.html()).toMatchInlineSnapshot('"<div>2</div>"')
    })

    it('expect server component to set the response into the payload', async () => {
      const wrapper = await mountSuspended(
        createServerComponent('CacheTest'), {
        props: {
          useCache: false,
          setCache: true,
          props: {
            test: 1
          }
        }
      })

      expect(fetch).toHaveBeenCalledOnce()
      expect(wrapper.html()).toMatchInlineSnapshot('"<div>1</div>"')
 
      expect(Object.keys(useNuxtApp().payload.data).length).toBe(1)
    })

    it('expect server component to NOT set the response into the payload', async () => {
      const wrapper = await mountSuspended(
        createServerComponent('CacheTest'), {
        props: {
          useCache: false,
          setCache: false,
          props: {
            test: 1
          }
        }
      })

      expect(fetch).toHaveBeenCalledOnce()
      expect(wrapper.html()).toMatchInlineSnapshot('"<div>1</div>"')
      expect(Object.keys(useNuxtApp().payload.data).length).toBe(0) 
    })
  })
})
