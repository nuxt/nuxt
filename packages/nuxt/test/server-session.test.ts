import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { clearSession, getSession, updateSession, useSession } from '../src/server/index'
import type { RequestEvent, Session, SessionConfig, SessionPassword } from '../src/server/index'

const runtimeConfig = vi.hoisted(() => ({ appSecret: '' }))

vi.mock('nuxt/internal/server-runtime-config', () => ({
  useRuntimeConfig: () => runtimeConfig,
}))

const password = 'a'.repeat(32)

function event (cookie?: string): RequestEvent {
  const request = new Request('https://nuxt.com/', { headers: cookie ? { cookie } : undefined })
  return { req: request, url: new URL(request.url), res: { headers: new Headers() }, context: {} }
}

function sessionCookie (e: RequestEvent, name = 'nuxt-session'): string {
  const header = e.res.headers.getSetCookie().find(c => c.startsWith(`${name}=`))!
  return header.split(';')[0]!
}

const config: SessionConfig = { password }

describe('`getSession`', () => {
  it('creates an empty session and seals it into the response cookie', async () => {
    const e = event()
    const session = await getSession(e, config)
    expect(session.data).toEqual({})
    expect(session.id).toMatch(/^[\da-f-]{36}$/)
    expect(e.res.headers.getSetCookie()).toEqual([expect.stringMatching(/^nuxt-session=Fe26\.2\*/)])
  })

  it('defaults the cookie to httpOnly, secure, lax and the root path', async () => {
    const e = event()
    await getSession(e, config)
    const [cookie] = e.res.headers.getSetCookie()
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('resolves the same session for repeated calls in one request', async () => {
    const e = event()
    expect(await getSession(e, config)).toBe(await getSession(e, config))
    expect(e.res.headers.getSetCookie()).toHaveLength(1)
  })

  it('keeps the data of a session updated while it is still loading', async () => {
    const first = event()
    await updateSession(first, config, { user: 'daniel' })

    const second = event(sessionCookie(first))
    const [loaded, updated] = await Promise.all([
      getSession(second, config),
      updateSession(second, config, { visits: 1 }),
    ])
    expect(loaded).toBe(updated)
    expect(updated.data).toEqual({ user: 'daniel', visits: 1 })

    const third = await getSession(event(sessionCookie(second)), config)
    expect(third.data).toEqual({ user: 'daniel', visits: 1 })
  })

  it('keeps sessions of different names apart', async () => {
    const e = event()
    const a = await getSession(e, { ...config, name: 'a' })
    const b = await getSession(e, { ...config, name: 'b' })
    expect(a.id).not.toBe(b.id)
    expect(e.res.headers.getSetCookie()).toHaveLength(2)
  })

  it('types the data it resolves', async () => {
    const session = await getSession<{ user: string }>(event(), config)
    expectTypeOf(session).toEqualTypeOf<Session<{ user: string }>>()
    expectTypeOf(session.data.user).toEqualTypeOf<string>()
  })
})

describe('`updateSession`', () => {
  it('merges data in and reseals the cookie once', async () => {
    const e = event()
    await updateSession(e, config, { user: 'daniel' })
    const session = await updateSession(e, config, data => ({ visits: (data.visits as number ?? 0) + 1 }))
    expect(session.data).toEqual({ user: 'daniel', visits: 1 })
    expect(e.res.headers.getSetCookie()).toHaveLength(1)
  })

  it('carries the data to the next request that sends the cookie', async () => {
    const first = event()
    await updateSession(first, config, { user: 'daniel' })

    const second = event(sessionCookie(first))
    const session = await getSession(second, config)
    expect(session.data).toEqual({ user: 'daniel' })
    expect(second.res.headers.getSetCookie()).toEqual([])
  })
})

describe('`clearSession`', () => {
  it('expires the cookie and forgets the data held for the request', async () => {
    const e = event()
    await updateSession(e, config, { user: 'daniel' })
    await clearSession(e, config)

    expect(e.res.headers.getSetCookie()).toEqual(['nuxt-session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'])
    await expect(getSession(e, config)).resolves.toMatchObject({ data: {} })
  })
})

describe('`useSession`', () => {
  it('reads and writes the session through the manager', async () => {
    const e = event()
    const session = await useSession<{ user: string }>(e, config)
    expect(session.data).toEqual({})

    await session.update({ user: 'daniel' })
    expect(session.data.user).toBe('daniel')
    expectTypeOf(session.data.user).toEqualTypeOf<string>()

    const id = session.id
    await session.clear()
    expect(session.data).toEqual({})
    expect(session.id).not.toBe(id)
  })
})

describe('an untrustworthy cookie', () => {
  it('is replaced when it was sealed with another password', async () => {
    const first = event()
    await updateSession(first, config, { role: 'admin' })

    const second = event(sessionCookie(first))
    const session = await getSession(second, { password: 'b'.repeat(32) })
    expect(session.data).toEqual({})
  })

  it('is replaced when it has been tampered with', async () => {
    const first = event()
    await updateSession(first, config, { role: 'user' })

    const tampered = sessionCookie(first).slice(0, -4) + 'aaaa'
    const session = await getSession(event(tampered), config)
    expect(session.data).toEqual({})
  })
})

describe('the password type', () => {
  it('is a string or bytes, owned by `nuxt/server`', () => {
    expectTypeOf<SessionPassword>().toEqualTypeOf<string | Uint8Array>()
    expectTypeOf<SessionConfig['password']>().toEqualTypeOf<SessionPassword | undefined>()
  })
})

describe('the cookie size limit', () => {
  it('refuses to write a session larger than browsers accept', async () => {
    const e = event()
    await expect(updateSession(e, config, { blob: 'x'.repeat(5000) })).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('over the 4096 byte limit'),
    })
  })
})

describe('without a `password`', () => {
  it('seals with a secret derived from `appSecret`, and reads it back', async () => {
    runtimeConfig.appSecret = 'a'.repeat(32)
    const first = event()
    await updateSession(first, {}, { user: 'daniel' })

    const session = await getSession(event(sessionCookie(first)))
    expect(session.data).toEqual({ user: 'daniel' })
  })

  it('derives a different secret for each cookie name', async () => {
    runtimeConfig.appSecret = 'a'.repeat(32)
    const first = event()
    await updateSession(first, { name: 'a' }, { user: 'daniel' })

    const cookie = sessionCookie(first, 'a').replace(/^a=/, 'b=')
    const session = await getSession(event(cookie), { name: 'b' })
    expect(session.data).toEqual({})
  })

  it('rejects a request when `appSecret` is unset, rather than starting a session', async () => {
    runtimeConfig.appSecret = ''
    const e = event()
    await expect(getSession(e)).rejects.toMatchObject({ status: 500, message: expect.stringContaining('NUXT_APP_SECRET') })
    expect(e.res.headers.getSetCookie()).toEqual([])
  })

  it('rejects a request carrying a cookie when `appSecret` is unset', async () => {
    runtimeConfig.appSecret = 'a'.repeat(32)
    const first = event()
    await updateSession(first, {}, { user: 'daniel' })

    runtimeConfig.appSecret = ''
    await expect(getSession(event(sessionCookie(first)))).rejects.toMatchObject({ status: 500 })
  })
})
