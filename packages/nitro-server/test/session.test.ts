import { describe, expect, it, vi } from 'vitest'
import { createEvent } from 'h3'
import type { RequestEvent } from 'nuxt/server'

vi.mock('nitropack/runtime', () => ({
  getRouteRules: () => ({}),
  useRuntimeConfig: () => ({}),
}))

vi.mock('nuxt/internal/server-runtime-config', () => ({
  useRuntimeConfig: () => ({ appSecret: 's'.repeat(32) }),
}))

const { defineEventHandler, useSession } = await import('../src/runtime/server.ts')

const config = { password: 'a'.repeat(32), name: 'session', cookie: { secure: false } }

/**
 * The session helpers as a nitropack v2 build resolves them, over the event a handler
 * registered through the delegate is given, with the response built from the headers
 * written to the node response behind it.
 */
function serve (handler: (event: RequestEvent) => Promise<unknown>) {
  const wrapped = defineEventHandler(handler)
  return async function fetch (request: Request): Promise<Response> {
    const url = new URL(request.url)
    const written: Record<string, string | string[] | undefined> = {}
    const req = {
      method: request.method,
      url: url.pathname + url.search,
      headers: Object.fromEntries(request.headers),
    }
    const res = {
      statusCode: 200,
      statusMessage: undefined as string | undefined,
      setHeader: (name: string, value: string | string[]) => { written[name.toLowerCase()] = value },
      getHeader: (name: string) => written[name.toLowerCase()],
      getHeaders: () => written,
      hasHeader: (name: string) => name.toLowerCase() in written,
      removeHeader: (name: string) => { delete written[name.toLowerCase()] },
    }

    const body = await wrapped(createEvent(req as never, res as never))

    const headers = new Headers()
    for (const [name, value] of Object.entries(written)) {
      for (const entry of Array.isArray(value) ? value : [value]) {
        if (entry !== undefined) {
          headers.append(name, String(entry))
        }
      }
    }
    return new Response(JSON.stringify(body ?? null), { status: res.statusCode, headers })
  }
}

function cookieFrom (response: Response, name = 'session'): string {
  const header = response.headers.getSetCookie().find(cookie => cookie.startsWith(`${name}=`))
  expect(header, `no \`${name}\` cookie was set`).toBeTruthy()
  return header!.split(';')[0]!
}

describe('sessions through the h3 request event', () => {
  it('seals a session into a cookie and reads it back on the next request', async () => {
    const fetch = serve(async (event) => {
      const session = await useSession<{ visits: number }>(event, config)
      await session.update(data => ({ visits: (data.visits ?? 0) + 1 }))
      return { id: session.id, visits: session.data.visits }
    })

    const first = await fetch(new Request('https://nuxt.com/api/visits'))
    const firstBody = await first.json()
    expect(firstBody.visits).toBe(1)

    const cookie = cookieFrom(first)
    expect(first.headers.getSetCookie()).toHaveLength(1)
    expect(first.headers.getSetCookie()[0]).toContain('HttpOnly')
    expect(first.headers.getSetCookie()[0]).toContain('SameSite=Lax')
    expect(first.headers.getSetCookie()[0]).toContain('Path=/')

    const second = await fetch(new Request('https://nuxt.com/api/visits', { headers: { cookie } }))
    const secondBody = await second.json()
    expect(secondBody.visits).toBe(2)
    expect(secondBody.id).toBe(firstBody.id)
  })

  it('round-trips without a `password`', async () => {
    const fetch = serve(async (event) => {
      const session = await useSession<{ visits: number }>(event, { cookie: { secure: false } })
      await session.update(data => ({ visits: (data.visits ?? 0) + 1 }))
      return { visits: session.data.visits }
    })

    const first = await fetch(new Request('https://nuxt.com/'))
    await expect(first.json()).resolves.toEqual({ visits: 1 })

    const second = await fetch(new Request('https://nuxt.com/', { headers: { cookie: cookieFrom(first, 'nuxt-session') } }))
    await expect(second.json()).resolves.toEqual({ visits: 2 })
  })
})
