import { createSSRApp } from 'vue'
import { tracingChannel } from 'node:diagnostics_channel'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('#build/nuxt.config.mjs', async (importOriginal) => {
  return { ...await importOriginal<Record<string, unknown>>(), appId: 'nuxt-app', multiApp: false, vapor: false, chunkErrorEvent: false, tracingChannelNuxt: true }
})

describe('nuxt.hook tracing channel', () => {
  beforeAll(() => {
    (globalThis as any).__TEST_SERVER__ = true
    vi.stubGlobal('__NUXT_ASYNC_CONTEXT__', false)
  })
  afterAll(() => {
    delete (globalThis as any).__TEST_SERVER__
    vi.unstubAllGlobals()
  })

  it('should trace hook calls that have listeners', async () => {
    const { createNuxtApp } = await import('../src/app/nuxt.ts')
    const nuxtApp = createNuxtApp({ vueApp: createSSRApp({}), ssrContext: { runtimeConfig: { public: {}, app: {} }, payload: {} } as any })

    const events: Array<[string, unknown]> = []
    const handlers = {
      start: (ctx: any) => events.push(['start', ctx.hook]),
      asyncEnd: (ctx: any) => events.push(['asyncEnd', ctx.hook]),
    }
    const channel = tracingChannel('nuxt.hook')
    channel.subscribe(handlers as any)
    try {
      const calls: string[] = []
      nuxtApp.hook('app:rendered', () => { calls.push('app:rendered') })
      await nuxtApp.callHook('app:rendered', {} as any)
      await nuxtApp.callHook('app:created', {} as any)
      expect(calls).toEqual(['app:rendered'])
      expect(events).toEqual([
        ['start', { name: 'app:rendered' }],
        ['asyncEnd', { name: 'app:rendered' }],
      ])
    } finally {
      channel.unsubscribe(handlers as any)
    }
  })
})
