import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { HookableCore } from 'hookable'
import { mockEvent } from 'nitro/h3'

const nitroApp = vi.hoisted(() => ({ hooks: undefined as unknown }))

vi.mock('nitro/app', () => ({ useNitroApp: () => nitroApp }))
vi.mock('nitro/cache', () => ({
  defineCachedHandler: (handler: (event: unknown) => unknown, options: { toResponse: (value: unknown, event: unknown) => unknown }) =>
    async (event: unknown) => options.toResponse(await handler(event), event),
}))
vi.mock('../src/runtime/utils/app-config.ts', () => ({}))

const { cachedEventHandler, defineCachedEventHandler, useNitroApp } = await import('../src/runtime/compat/nitro-v2.ts')
const { wrapLegacyPlugin } = await import('../src/runtime/compat/legacy-plugin.ts')
const { serverDiagnostics } = await import('../src/runtime/diagnostics.ts')

describe('nitro v2 `useNitroApp`', () => {
  it('returns the `nitroApp` a nitro v2 plugin receives', () => {
    nitroApp.hooks = new HookableCore()
    let received: unknown
    wrapLegacyPlugin((app) => { received = app })(nitroApp as any)

    expect(useNitroApp()).toBe(received)
    expect(useNitroApp().hooks).toBe((received as typeof nitroApp).hooks)
    expect(useNitroApp().hooks!.callHook('close')).toBeInstanceOf(Promise)
  })

  it.each([false, true])('returns the `nitroApp` a named nitro v2 plugin receives (prerendering: %s)', (prerender) => {
    vi.stubGlobal('__TEST_PRERENDER__', prerender)
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8017').mockImplementation(() => ({}) as any)
    onTestFinished(() => {
      vi.unstubAllGlobals()
      report.mockRestore()
    })
    nitroApp.hooks = new HookableCore()
    const state = new WeakMap<object, string>()
    let received: any
    wrapLegacyPlugin((app) => {
      received = app
      state.set(app, 'plugin')
      app.hooks.hook('close', () => {})
    }, 'server/plugins/state.ts')(nitroApp as any)

    expect(useNitroApp()).toBe(received)
    expect(useNitroApp().hooks).toBe(received.hooks)
    expect(state.get(useNitroApp())).toBe('plugin')
    expect(report).toHaveBeenCalledTimes(prerender ? 1 : 0)
  })
})

describe('nitro v2 `defineCachedEventHandler`', () => {
  it.each([defineCachedEventHandler, cachedEventHandler])('answers a handler that returns `null` with no content', async (define) => {
    const response = await define(() => null)(mockEvent('http://nuxt/api/_nuxt_icon/custom.json?icons=nope'))

    expect(response.status).toBe(204)
  })

  it('passes on what any other handler returns', async () => {
    const data = { icons: {} }
    const response = await defineCachedEventHandler(() => data)(mockEvent('http://nuxt/api/icons'))
    expect(await response.json()).toEqual(data)
  })
})
