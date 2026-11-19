import { describe, expect, it, vi } from 'vitest'
import { HookableCore } from 'hookable'
import { HTTPResponse, mockEvent } from 'nitro/h3'

const nitroApp = vi.hoisted(() => ({ hooks: undefined as unknown }))

vi.mock('nitro/app', () => ({ useNitroApp: () => nitroApp }))
vi.mock('nitro/cache', () => ({ defineCachedHandler: (handler: unknown) => handler }))
vi.mock('../src/runtime/utils/app-config.ts', () => ({}))

const { cachedEventHandler, defineCachedEventHandler, useNitroApp } = await import('../src/runtime/compat/nitro-v2.ts')
const { wrapLegacyPlugin } = await import('../src/runtime/compat/legacy-plugin.ts')

describe('nitro v2 `useNitroApp`', () => {
  it('returns the `nitroApp` a nitro v2 plugin receives', () => {
    nitroApp.hooks = new HookableCore()
    let received: unknown
    wrapLegacyPlugin((app) => { received = app })(nitroApp as any)

    expect(useNitroApp()).toBe(received)
    expect(useNitroApp().hooks).toBe((received as typeof nitroApp).hooks)
    expect(useNitroApp().hooks!.callHook('close')).toBeInstanceOf(Promise)
  })
})

describe('nitro v2 `defineCachedEventHandler`', () => {
  it.each([defineCachedEventHandler, cachedEventHandler])('answers a handler that returns `null` with no content', async (define) => {
    const response = await (define(() => null) as (event: unknown) => Promise<unknown>)(mockEvent('http://nuxt/api/_nuxt_icon/custom.json?icons=nope'))

    expect(response).toBeInstanceOf(HTTPResponse)
    expect((response as HTTPResponse).status).toBe(204)
  })

  it('passes on what any other handler returns', async () => {
    const data = { icons: {} }
    expect(await (defineCachedEventHandler(() => data) as (event: unknown) => Promise<unknown>)(mockEvent('http://nuxt/api/icons'))).toBe(data)
  })
})
