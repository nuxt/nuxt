import { describe, expect, it, vi } from 'vitest'
import { useSession } from 'nuxt/server'
import type { RequestEvent } from 'nuxt/server'

import { createRequestEvent } from '../src/runtime/event.ts'

vi.mock('nuxt/internal/server-runtime-config', () => ({
  useRuntimeConfig: () => ({ appSecret: 's'.repeat(32) }),
}))

const config = { password: 'a'.repeat(32), name: 'session', cookie: { secure: false } }

/**
 * The renderer contract the vite server builds on: a handler is given the event
 * `createRequestEvent()` produced, and the response carries the headers written
 * to `event.res`.
 */
function serve (handler: (event: RequestEvent) => Promise<unknown>) {
  return async function fetch (request: Request): Promise<Response> {
    const event = createRequestEvent(request) as unknown as RequestEvent
    const body = await handler(event)
    return new Response(JSON.stringify(body ?? null), {
      status: event.res.status ?? 200,
      headers: event.res.headers,
    })
  }
}

function cookieFrom (response: Response, name = 'session'): string {
  const header = response.headers.getSetCookie().find(cookie => cookie.startsWith(`${name}=`))
  expect(header, `no \`${name}\` cookie was set`).toBeTruthy()
  return header!.split(';')[0]!
}

describe('sessions through the vite server request event', () => {
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
