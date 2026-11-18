import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h } from 'vue'
import type { NuxtSSRContext } from '../../packages/nuxt/src/app/types.ts'
import { createNuxtRenderer } from '../../packages/nuxt/src/runtime/server/renderer/index.ts'
import { createRendererInstance } from '../../packages/nuxt/src/runtime/server/renderer/instance.ts'

import { createEvent, options } from './harness'

vi.mock('nuxt/internal/renderer-config', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  NUXT_SSR_STREAMING: true,
}))

const hookError = new Error('the hook threw')
const renderError = () => Object.assign(new Error('the render failed'), { name: 'HTTPError', status: 503, statusText: 'Service Unavailable' })

/** An app whose `app:error` hook rejects. */
function withRejectingHook (ssrContext: NuxtSSRContext) {
  ssrContext.nuxt = {
    hooks: { callHook: (name: string) => name === 'app:error' ? Promise.reject(hookError) : undefined },
  } as unknown as NuxtSSRContext['nuxt']
}

let consoleError: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  consoleError.mockRestore()
})

function renderWith (overrides: (instance: ReturnType<typeof createRendererInstance>) => void, streaming: boolean) {
  const instance = createRendererInstance({ ...options, getRouteRules: () => ({ ssr: true, streaming }) })
  overrides(instance)
  return createNuxtRenderer(instance).fetch(createEvent('/', { headers: { 'user-agent': 'Mozilla/5.0' } }))
}

describe('a rejecting `app:error` hook', () => {
  it('does not replace the error of a buffered render', async () => {
    const response = await renderWith((instance) => {
      const getRenderer = instance.getRenderer
      instance.getRenderer = async (ssrContext) => {
        const renderer = await getRenderer(ssrContext)
        if (ssrContext.error) { return renderer }
        return {
          ...renderer,
          renderToString: (context: NuxtSSRContext) => {
            withRejectingHook(context)
            return Promise.reject(renderError())
          },
        }
      }
    }, false)

    expect(response.status).toBe(503)
    expect(await response.text()).toContain('the render failed')
    expect(consoleError).toHaveBeenCalledWith('[nuxt] Error in `app:error` hook', hookError)
  })

  it('does not replace the error of a streamed app that fails to create', async () => {
    const response = await renderWith((instance) => {
      instance.getServerApp = () => Promise.resolve((ssrContext: NuxtSSRContext) => {
        withRejectingHook(ssrContext)
        return Promise.reject(renderError())
      })
    }, true)

    expect(response.status).toBe(503)
    expect(await response.text()).toContain('the render failed')
    expect(consoleError).toHaveBeenCalledWith('[nuxt] Error in `app:error` hook', hookError)
  })

  it('does not replace the error of a streamed app that fails to render its shell', async () => {
    const response = await renderWith((instance) => {
      instance.getServerApp = () => Promise.resolve((ssrContext: NuxtSSRContext) => {
        withRejectingHook(ssrContext)
        return Promise.resolve(createSSRApp({ setup: () => Promise.reject(renderError()) }))
      })
    }, true)

    expect(response.status).toBe(503)
    expect(await response.text()).toContain('the render failed')
    expect(consoleError).toHaveBeenCalledWith('[nuxt] Error in `app:error` hook', hookError)
  })

  it('does not break a streamed response with an error raised after the shell', async () => {
    const response = await renderWith((instance) => {
      instance.getServerApp = () => Promise.resolve((ssrContext: NuxtSSRContext) => {
        withRejectingHook(ssrContext)
        const Late = defineComponent({
          async setup () {
            await new Promise(resolve => setTimeout(resolve, 10))
            ssrContext.payload.error = { status: 503, message: 'the render failed' } as NonNullable<NuxtSSRContext['payload']['error']>
            return () => h('p', 'late')
          },
        })
        return Promise.resolve(createSSRApp({ render: () => h('div', [h('span', 'shell'), h(Late)]) }))
      })
    }, true)

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('</html>')
    expect(consoleError).toHaveBeenCalledWith('[nuxt] Error in `app:error` hook', hookError)
  })

  it('does not break a streamed response with an error thrown after the shell', async () => {
    const response = await renderWith((instance) => {
      instance.getServerApp = () => Promise.resolve((ssrContext: NuxtSSRContext) => {
        withRejectingHook(ssrContext)
        const Late = defineComponent({
          async setup () {
            await new Promise(resolve => setTimeout(resolve, 10))
            throw renderError()
          },
        })
        return Promise.resolve(createSSRApp({ render: () => h('div', [h('span', 'shell'), h(Late)]) }))
      })
    }, true)

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('</html>')
    expect(consoleError).toHaveBeenCalledWith('[nuxt] Error in `app:error` hook', hookError)
  })
})
