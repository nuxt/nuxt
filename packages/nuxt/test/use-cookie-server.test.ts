import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import { createEvent } from 'h3'
import type { H3Event } from 'h3'
import type { RequestEvent } from 'nuxt/schema'

let nuxtApp: Record<string, any>

vi.mock('../src/app/nuxt', () => ({ useNuxtApp: () => nuxtApp, tryUseNuxtApp: () => nuxtApp }))

const { useCookie } = await import('../src/app/composables/cookie')

interface Shape {
  create: (cookie: string, setCookies: string[]) => unknown
  setCookies: (event: any) => string[]
}

const shapes: Record<string, Shape> = {
  'an h3 event': {
    create: (cookie, setCookies) => {
      const req = new IncomingMessage(new Socket())
      req.headers = { cookie }
      const res = new ServerResponse(req)
      if (setCookies.length) {
        res.setHeader('set-cookie', setCookies)
      }
      return createEvent(req, res)
    },
    setCookies: (event: H3Event) => [event.node.res.getHeader('set-cookie') ?? []].flat().map(String),
  },
  'a web-standard event': {
    create: (cookie, setCookies): RequestEvent => {
      const headers = new Headers()
      for (const setCookie of setCookies) {
        headers.append('set-cookie', setCookie)
      }
      return {
        req: new Request('http://localhost/', { headers: { cookie } }),
        url: new URL('http://localhost/'),
        res: { headers },
        context: {},
      }
    },
    setCookies: (event: RequestEvent) => event.res.headers.getSetCookie(),
  },
}

describe.each(Object.entries(shapes))('useCookie on %s', (_, shape) => {
  let event: unknown

  function setup (cookie = '', setCookies: string[] = []) {
    event = shape.create(cookie, setCookies)
    nuxtApp = { hooks: createHooks(), ssrContext: { event } }
  }

  const render = () => nuxtApp.hooks.callHook('app:rendered')

  beforeEach(() => {
    vi.stubGlobal('__TEST_SERVER__', true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should read cookies from the request and the response', () => {
    setup('a=from-request; b=stale', ['b=from-response; Path=/'])
    expect(useCookie('a').value).toBe('from-request')
    expect(useCookie('b').value).toBe('from-response')
  })

  it('should append a cookie for each one written', async () => {
    setup('', ['other=1; Path=/'])
    useCookie('a').value = 'one two/✓'
    useCookie('b').value = 'two'
    await render()
    expect(shape.setCookies(event)).toEqual(['other=1; Path=/', 'a=one%20two%2F%E2%9C%93; Path=/', 'b=two; Path=/'])
  })

  it('should replace a cookie the response already sets', async () => {
    setup('', ['a=old; Path=/', 'other=1; Path=/', 'a=elsewhere; Path=/admin'])
    useCookie('a').value = 'new'
    await render()
    expect(shape.setCookies(event)).toEqual(['other=1; Path=/', 'a=elsewhere; Path=/admin', 'a=new; Path=/'])
  })

  it('should delete a cookie the request sends', async () => {
    setup('a=1')
    useCookie('a').value = null
    useCookie('missing').value = null
    await render()
    expect(shape.setCookies(event)).toEqual(['a=; Max-Age=0; Path=/'])
  })

  it('should delete a cookie only the response sets', async () => {
    setup('', ['session=from-middleware; Path=/', 'other=keep; Path=/'])
    const session = useCookie('session')
    expect(session.value).toBe('from-middleware')
    session.value = null
    await render()
    expect(shape.setCookies(event)).toEqual(['other=keep; Path=/', 'session=; Max-Age=0; Path=/'])
  })

  it('should not write a readonly cookie', async () => {
    setup('a=1')
    useCookie('b', { readonly: true, default: () => 'default' })
    await render()
    expect(shape.setCookies(event)).toEqual([])
  })
})

describe('useCookie on a web-standard event', () => {
  beforeEach(() => {
    vi.stubGlobal('__TEST_SERVER__', true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should only replace a cookie with the same domain', async () => {
    const shape = shapes['a web-standard event']!
    const event = shape.create('', ['a=old; Domain=.EXAMPLE.COM; Path=/', 'a=other; Domain=other.example; Path=/', 'a=host-only; Path=/'])
    nuxtApp = { hooks: createHooks(), ssrContext: { event } }
    useCookie('a', { domain: 'example.com' }).value = 'new'
    await nuxtApp.hooks.callHook('app:rendered')
    expect(shape.setCookies(event)).toEqual(['a=other; Domain=other.example; Path=/', 'a=host-only; Path=/', 'a=new; Domain=example.com; Path=/'])
  })
})
