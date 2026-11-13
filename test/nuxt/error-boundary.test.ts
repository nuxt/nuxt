/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mount } from '@vue/test-utils'
import type { ComponentSlots } from 'vue-component-type-helpers'
import { Suspense, Teleport, createSSRApp, defineComponent, h, onErrorCaptured, useId } from 'vue'
import type { VNode } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { NuxtErrorBoundary } from '#components'
import { useNuxtApp } from '#app/nuxt'
import { createError, isNuxtError } from '#app/composables/error'
import type { NuxtError } from '#app/composables/error'
import NuxtErrorBoundaryServer from '../../packages/nuxt/src/app/components/nuxt-error-boundary.server'

describe('NuxtErrorBoundary', () => {
  it('should render children when there is no error', () => {
    const el = mount({
      setup () {
        return () => h('div', {}, h(NuxtErrorBoundary, {}, {
          default: () => h('span', 'default'),
          error: () => h('span', 'error'),
        }))
      },
    })
    expect(el.html()).toMatchInlineSnapshot(`"<div><span>default</span></div>"`)
    el.unmount()
  })

  it('should handle error state', async () => {
    let thrown = false
    // suppress Vue warning: [Vue warn]: Component is missing template or render function:
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = mount({
      setup () {
        return () => h('div', {}, h(NuxtErrorBoundary, {}, {
          default: () => h(defineComponent({
            setup () {
              if (!thrown) {
                thrown = true
                throw new Error('test error')
              }
              return () => h('span', 'default')
            },
          })),
          error: (
            { error, clearError }: Parameters<ComponentSlots<typeof NuxtErrorBoundary>['error']>[0],
          ) => h('button', { onClick: () => clearError() }, error.toString()),
        }))
      },
    })
    await nextTick()
    expect(el.html()).toMatchInlineSnapshot(`"<div><button>Error: test error</button></div>"`)
    await el.find('button').trigger('click')
    expect(el.html()).toMatchInlineSnapshot(`"<div><span>default</span></div>"`)
    el.unmount()
    vi.resetAllMocks()
  })

  it('shows errors from the retried default slot while the app is still hydrating', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nuxtApp = useNuxtApp()
    let key: string | undefined
    mount(defineComponent({
      setup: () => () => h(Suspense, null, h(defineComponent({
        setup () {
          key = useId()
          return () => null
        },
      }))),
    })).unmount()
    nuxtApp.payload.state[`$s${key}`] = createError('ssr error')
    nuxtApp.isHydrating = true

    const AsyncThrows = defineComponent({
      async setup () {
        await new Promise(resolve => setTimeout(resolve, 10))
        throw new Error('client error')
      },
    })
    const el = mount(defineComponent({
      setup: () => () => h(Suspense, null, h(NuxtErrorBoundary, { retryOnClient: true }, {
        default: () => h(AsyncThrows),
        error: ({ error }: { error: Error }) => h('p', error.message),
      })),
    }))
    try {
      await vi.waitFor(() => expect(el.html()).toContain('<p>client error</p>'))
    } finally {
      nuxtApp.isHydrating = false
      el.unmount()
      vi.restoreAllMocks()
    }
  })
})

const flags = { ssrErrorBoundary: true }
vi.mock('#build/nuxt.config.mjs', async original => ({
  ...(await original<Record<string, unknown>>()),
  get ssrErrorBoundary () { return flags.ssrErrorBoundary },
}))

describe('NuxtErrorBoundary (server)', () => {
  const Throws = defineComponent({
    props: { async: Boolean, message: { type: String, default: 'ssr boom' } },
    setup (props) {
      const fail = () => {
        throw createError({ status: 418, statusText: 'teapot', message: props.message, data: { flavour: 'earl grey' } })
      }
      return props.async ? Promise.resolve().then(fail) : fail()
    },
  })

  function renderBoundary (child: () => VNode | VNode[], opts: { onError?: (e: Error) => void } = {}) {
    const escaped: unknown[] = []
    const app = createSSRApp(defineComponent({
      setup () {
        onErrorCaptured((err) => {
          escaped.push(err)
          return false
        })
        return () => h(NuxtErrorBoundaryServer, { onError: opts.onError }, {
          default: child,
          error: ({ error }: { error: NuxtError }) => h('p', { class: 'caught' }, `${error.status} ${error.message} ${JSON.stringify(error.data)}`),
        })
      },
    }))
    const ssrContext: { teleports?: Record<string, string> } = {}
    return renderToString(app, ssrContext).then(html => ({ html, escaped, teleports: ssrContext.teleports }))
  }

  beforeEach(() => {
    flags.ssrErrorBoundary = true
    // every `createSSRApp` here yields the same `useId()`
    for (const key in useNuxtApp().payload.state) {
      delete useNuxtApp().payload.state[key]
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the default slot when nothing throws', async () => {
    const { html, escaped } = await renderBoundary(() => h('span', 'fine'))
    expect(html).toBe('<!--[--><span>fine</span><!--]-->')
    expect(escaped).toEqual([])
  })

  it('renders the error slot when a child throws in setup', async () => {
    const onError = vi.fn()
    const { html, escaped } = await renderBoundary(() => [h('span', 'sibling'), h(Throws)], { onError })
    expect(html).toBe('<!--[--><p class="caught">418 ssr boom {&quot;flavour&quot;:&quot;earl grey&quot;}</p><!--]-->')
    expect(escaped).toEqual([])
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]![0]).toMatchObject({ status: 418 })
  })

  it('renders the error slot when a child throws in async setup', async () => {
    const { html, escaped } = await renderBoundary(() => h(Throws, { async: true, message: 'async boom' }))
    expect(html).toContain('418 async boom')
    expect(escaped).toEqual([])
  })

  it('renders the error slot when a child throws while rendering', async () => {
    const RenderThrows = defineComponent({
      props: { async: Boolean },
      setup: props => props.async ? Promise.resolve({}) : {},
      ssrRender () {
        throw createError({ status: 418, message: 'render boom' })
      },
    })
    for (const async of [false, true]) {
      const { html, escaped } = await renderBoundary(() => [h('span', 'partial'), h(RenderThrows, { async })])
      expect(html).toBe('<!--[--><p class="caught">418 render boom undefined</p><!--]-->')
      expect(escaped).toEqual([])
    }
  })

  it('discards content teleported by a default slot that throws', async () => {
    const { html, teleports } = await renderBoundary(() => [
      h(Teleport, { to: 'body' }, h('div', 'discarded')),
      h(Throws, { message: 'after teleport' }),
    ])
    expect(html).toBe('<!--[--><p class="caught">418 after teleport {&quot;flavour&quot;:&quot;earl grey&quot;}</p><!--]-->')
    expect(teleports?.body ?? '').not.toContain('discarded')
  })

  it('waits for async components inside a teleport before choosing a slot', async () => {
    const { html, escaped, teleports } = await renderBoundary(() => [
      h('span', 'partial'),
      h(Teleport, { to: 'body' }, h(Throws, { async: true, message: 'teleported boom' })),
    ])
    expect(html).toBe('<!--[--><p class="caught">418 teleported boom {&quot;flavour&quot;:&quot;earl grey&quot;}</p><!--]-->')
    expect(escaped).toEqual([])
    expect(teleports?.body ?? '').toBe('')
  })

  it('does not share an error caught after the default slot was rendered', async () => {
    const LateThrows = defineComponent({
      async setup () {
        await new Promise(resolve => setTimeout(resolve, 10))
        throw createError('late boom')
      },
    })
    const AsyncTeleport = defineComponent({
      async setup () {
        await Promise.resolve()
        return () => [h('span', 'rendered'), h(Teleport, { to: 'body' }, h(LateThrows))]
      },
    })
    const { html, escaped } = await renderBoundary(() => h(AsyncTeleport))
    expect(html).toContain('<span>rendered</span>')
    expect(escaped).toEqual([])
    expect(Object.values(useNuxtApp().payload.state)).toEqual([])
  })

  it('renders the error slot when a child pushes a rejected promise', async () => {
    const Rejects = defineComponent({
      ssrRender (_ctx: unknown, push: (item: unknown) => void) {
        push(new Promise(resolve => setTimeout(() => resolve([]), 10)))
        push(Promise.reject(createError({ status: 418, message: 'rejected boom' })))
      },
    })
    const { html, escaped } = await renderBoundary(() => [h('span', 'partial'), h(Rejects)])
    expect(html).toBe('<!--[--><p class="caught">418 rejected boom undefined</p><!--]-->')
    expect(escaped).toEqual([])
  })

  it('renders the error slot when the default slot itself throws', async () => {
    const { html, escaped } = await renderBoundary(() => {
      throw createError({ status: 418, message: 'slot boom' })
    })
    expect(html).toBe('<!--[--><p class="caught">418 slot boom undefined</p><!--]-->')
    expect(escaped).toEqual([])
  })

  it('lets an enclosing boundary catch an error thrown by its error slot', async () => {
    const { html, escaped } = await renderBoundary(() => h(NuxtErrorBoundaryServer, null, {
      default: () => h(Throws, { message: 'inner default boom' }),
      error: () => h(Throws, { async: true, message: 'inner error slot boom' }),
    }))
    expect(html).toBe('<!--[--><p class="caught">418 inner error slot boom {&quot;flavour&quot;:&quot;earl grey&quot;}</p><!--]-->')
    expect(escaped).toEqual([])
  })

  it('does not share state from the discarded default slot with the error slot', async () => {
    const boundary = (content: () => VNode | VNode[], error: () => VNode) => h(NuxtErrorBoundaryServer, null, { default: content, error })
    const html = await renderToString(createSSRApp(defineComponent({
      setup: () => () => boundary(
        () => [boundary(() => h(Throws), () => h('i', 'inner caught')), h(Throws)],
        () => boundary(() => h('span', 'fine'), () => h('i', 'inherited')),
      ),
    })))
    expect(html).toBe('<!--[--><!--[--><span>fine</span><!--]--><!--]-->')
  })

  it('does not expose the message of an error not created with `createError`', async () => {
    const nuxtApp = useNuxtApp()
    const Crashes = defineComponent({
      setup () {
        throw new Error('secret')
      },
    })
    const { html } = await renderBoundary(() => h(Crashes))
    expect(html).toBe('<!--[--><p class="caught">500 Internal Server Error undefined</p><!--]-->')
    expect(JSON.stringify(Object.values(nuxtApp.payload.state))).not.toContain('secret')
  })

  it('shares the caught error with the client via payload state', async () => {
    const nuxtApp = useNuxtApp()
    const before = Object.keys(nuxtApp.payload.state)
    await renderBoundary(() => h(Throws, { message: 'payload boom' }))
    const key = Object.keys(nuxtApp.payload.state).find(k => !before.includes(k))!
    expect(key).toBeDefined()
    const stored = nuxtApp.payload.state[key]
    expect(isNuxtError(stored)).toBe(true)
    expect(stored).toMatchObject({ status: 418, message: 'payload boom', data: { flavour: 'earl grey' } })
    delete nuxtApp.payload.state[key]
  })

  it('lets errors escape when `experimental.ssrErrorBoundary` is disabled', async () => {
    flags.ssrErrorBoundary = false
    const { html, escaped } = await renderBoundary(() => h(Throws, { message: 'escaping boom' }))
    expect(html).not.toContain('caught')
    expect(escaped).toHaveLength(1)
    expect(escaped[0]).toMatchObject({ message: 'escaping boom' })
  })

  it('calls `app.config.errorHandler` for errors it catches', async () => {
    const vueApp = useNuxtApp().vueApp
    const original = vueApp.config.errorHandler
    const errorHandler = vi.fn()
    vueApp.config.errorHandler = errorHandler
    try {
      await renderBoundary(() => h(Throws, { message: 'handled boom' }))
    } finally {
      vueApp.config.errorHandler = original
    }
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0]![0]).toMatchObject({ message: 'handled boom' })
  })

  it('generates the same `useId()` values as the client component', async () => {
    const UsesId = defineComponent({
      setup: () => {
        const id = useId()
        return () => h('i', { id })
      },
    })
    const AsyncUsesId = defineComponent({
      async setup () {
        await Promise.resolve()
        return () => h(UsesId)
      },
    })

    function render (Boundary: typeof NuxtErrorBoundaryServer) {
      const boundary = (child: () => VNode) => h(Boundary, null, {
        default: () => [h(UsesId), child()],
        error: () => h(UsesId),
      })
      return renderToString(createSSRApp(defineComponent({
        setup: () => () => h('div', [
          boundary(() => h(AsyncUsesId)),
          h(AsyncUsesId),
          boundary(() => h(Throws)),
          h(AsyncUsesId),
          boundary(() => h(Throws, { async: true })),
          h(AsyncUsesId),
          h(UsesId),
        ]),
      })))
    }

    const server = await render(NuxtErrorBoundaryServer)
    // the client component reads the errors the server render stored in payload state
    const client = await render(NuxtErrorBoundary as unknown as typeof NuxtErrorBoundaryServer)
    expect(server.match(/id="[^"]+"/g)).toHaveLength(8)
    expect(server).toBe(client)
  })
})
