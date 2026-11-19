import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { useCookie as UseCookie } from '../src/app/composables/cookie.ts'

const nuxtApp = vi.hoisted(() => ({} as Record<string, any>))

vi.mock('#app/nuxt', () => ({
  useNuxtApp: () => nuxtApp,
  tryUseNuxtApp: () => nuxtApp,
}))

vi.mock('../src/app/composables/ssr', () => ({
  useRequestEvent: () => nuxtApp.ssrContext.event,
  asWebRequestEvent: (event: unknown) => event,
}))

let useCookie: typeof UseCookie

beforeAll(async () => {
  vi.stubGlobal('__TEST_SERVER__', true)
  vi.stubGlobal('__TEST_DEV__', true)
  vi.stubGlobal('__TEST_TEST__', true)
  ;({ useCookie } = await import('../src/app/composables/cookie.ts'))
})

afterAll(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useCookie in a streamed render', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const lateWrites = () => warn.mock.calls.filter(args => args.join(' ').includes('NUXT_E7012')).length
  const setCookies = () => nuxtApp.ssrContext.event.res.headers.getSetCookie() as string[]

  function sendHeaders () {
    nuxtApp._cookieWriters?.forEach((write: () => void) => write())
    nuxtApp.ssrContext['~headersSent'] = true
  }
  const finishRender = () => nuxtApp.hooks.callHook('app:rendered')

  beforeEach(() => {
    warn.mockClear()
    for (const key in nuxtApp) { delete nuxtApp[key] }
    nuxtApp.hooks = createHooks()
    nuxtApp.ssrContext = {
      event: {
        req: new Request('http://localhost/', { headers: { cookie: 'shared=A; refreshed=A' } }),
        res: { headers: new Headers() },
      },
    }
  })

  it('reports a cookie assigned after the headers are sent', async () => {
    const cookie = useCookie('late')
    sendHeaders()
    cookie.value = 'B'
    await finishRender()

    expect(setCookies()).toEqual([])
    expect(lateWrites()).toBe(1)
    expect(warn.mock.calls[0]!.join(' ')).toContain('`late`')
  })

  it('reports an object cookie mutated after the headers are sent', async () => {
    const cookie = useCookie<{ count: number }>('object')
    cookie.value = { count: 1 }
    sendHeaders()
    cookie.value.count = 2
    await finishRender()

    expect(setCookies()).toEqual([`object=${encodeURIComponent('{"count":1}')}; Path=/`])
    expect(lateWrites()).toBe(1)
  })

  it('reports a `refresh` cookie reassigned after the headers are sent', async () => {
    const cookie = useCookie('refreshed', { refresh: true })
    sendHeaders()
    cookie.value = 'A'
    await finishRender()

    expect(setCookies()).toEqual([])
    expect(lateWrites()).toBe(1)
  })

  it('does not report an absent cookie that defaults to `null` after the headers are sent', async () => {
    sendHeaders()
    useCookie('absent', { default: () => null })
    await finishRender()

    expect(lateWrites()).toBe(0)
  })

  it('does not report cookies assigned before the headers are sent', async () => {
    const unchanged = useCookie('shared')
    useCookie('shared').value = 'B'
    useCookie('refreshed', { refresh: true }).value = 'A'
    sendHeaders()
    await finishRender()

    expect(unchanged.value).toBe('A')
    expect(setCookies()).toEqual(['shared=B; Path=/', 'refreshed=A; Path=/'])
    expect(lateWrites()).toBe(0)
  })
})
