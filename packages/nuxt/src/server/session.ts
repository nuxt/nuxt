import type { CookieSerializeOptions } from '../app/types/cookie'
import { serialize } from 'cookie-es'
import type { RequestEvent } from 'nuxt/schema'

import { createError } from '../app/error'
import { getCookie, setCookie } from './index'
import { seal, unseal } from './iron'
import { deriveSecret } from './secret'

/**
 * The part of the event the session helpers use.
 *
 * @since 5.0.0
 */
export type SessionEvent = Pick<RequestEvent, 'req' | 'res'>

/** @since 5.0.0 */
export type SessionData = Record<string, unknown>

/** @since 5.0.0 */
export interface Session<T extends SessionData = SessionData> {
  /** Generated when the session is created; stable across updates. */
  id: string
  data: T
}

/**
 * 32 characters or more, or 32 bytes or more.
 *
 * @since 5.0.0
 */
export type SessionPassword = string | Uint8Array

/** @since 5.0.0 */
export interface SessionConfig {
  /**
   * The secret to seal with. Defaults to one derived from `appSecret` for the
   * cookie name.
   */
  password?: SessionPassword
  /** Cookie name. Defaults to `nuxt-session`. */
  name?: string
  /** Lifetime in seconds of both the cookie and the sealed value. */
  maxAge?: number
  /** Merged over `httpOnly`, `secure`, `sameSite: 'lax'` and `path: '/'`. */
  cookie?: CookieSerializeOptions
}

/**
 * A session with the operations that write it back, as {@link useSession} returns it.
 *
 * @since 5.0.0
 */
export interface SessionManager<T extends SessionData = SessionData> {
  readonly id: string
  readonly data: T
  update: (update: SessionUpdate<T>) => Promise<SessionManager<T>>
  clear: () => Promise<SessionManager<T>>
}

/** @since 5.0.0 */
export type SessionUpdate<T extends SessionData = SessionData> = Partial<T> | ((data: T) => Partial<T> | undefined)

const DEFAULT_NAME = 'nuxt-session'

/** Browsers reject a cookie whose serialised form exceeds this. */
const MAX_COOKIE_BYTES = 4096

interface SessionEntry {
  loading: Promise<Session<any>>
  session?: Session<any>
}

const sessionCache = new WeakMap<object, Map<string, SessionEntry>>()

/**
 * The session for the request, with the operations that write it back.
 *
 * @example
 * ```ts
 * // server/api/visits.ts
 * import { defineEventHandler, useSession } from 'nuxt/server'
 *
 * export default defineEventHandler(async (event) => {
 *   const session = await useSession<{ visits: number }>(event)
 *   await session.update(data => ({ visits: (data.visits ?? 0) + 1 }))
 *   return { visits: session.data.visits }
 * })
 * ```
 *
 * @since 5.0.0
 */
export async function useSession<T extends SessionData = SessionData> (event: SessionEvent, config: SessionConfig = {}): Promise<SessionManager<T>> {
  await getSession<T>(event, config)
  const name = config.name ?? DEFAULT_NAME
  const current = () => sessionsOf(event).get(name)!.session as Session<T>

  const manager: SessionManager<T> = {
    get id () {
      return current().id
    },
    get data () {
      return current().data
    },
    async update (update) {
      await updateSession<T>(event, config, update)
      return manager
    },
    async clear () {
      await clearSession(event, config)
      return manager
    },
  }

  return manager
}

/**
 * The session for the request: unsealed from its cookie, or created empty and
 * sealed into the response when there is no cookie or it cannot be unsealed.
 * Unsealed once per request.
 *
 * @since 5.0.0
 */
export function getSession<T extends SessionData = SessionData> (event: SessionEvent, config: SessionConfig = {}): Promise<Session<T>> {
  const name = config.name ?? DEFAULT_NAME
  const sessions = sessionsOf(event)
  let entry = sessions.get(name)
  if (!entry) {
    const loading = loadSession(event, config)
    entry = { loading }
    sessions.set(name, entry)
    loading.then((session) => { entry!.session = session }, () => sessions.delete(name))
  }
  return entry.loading as Promise<Session<T>>
}

async function loadSession<T extends SessionData> (event: SessionEvent, config: SessionConfig): Promise<Session<T>> {
  const sealed = getCookie(event, config.name ?? DEFAULT_NAME)
  const unsealed = sealed ? await unsealSession<T>(sealed, config) : undefined
  if (unsealed) {
    return unsealed
  }
  const session: Session<T> = { id: globalThis.crypto.randomUUID(), data: Object.create(null) }
  await sealSession(event, config, session)
  return session
}

/**
 * Merge data into the session and reseal it.
 *
 * @since 5.0.0
 */
export async function updateSession<T extends SessionData = SessionData> (event: SessionEvent, config: SessionConfig = {}, update?: SessionUpdate<T>): Promise<Session<T>> {
  const session = await getSession<T>(event, config)
  const patch = typeof update === 'function' ? update(session.data) : update
  if (patch) {
    Object.assign(session.data, patch)
  }
  await sealSession(event, config, session)
  return session
}

/**
 * Discard the session and expire its cookie.
 *
 * @since 5.0.0
 */
export function clearSession (event: SessionEvent, config: SessionConfig = {}): Promise<void> {
  const name = config.name ?? DEFAULT_NAME
  const session: Session = { id: globalThis.crypto.randomUUID(), data: Object.create(null) }
  sessionsOf(event).set(name, { loading: Promise.resolve(session), session })
  setSessionCookie(event, name, '', { ...cookieOptions(config), maxAge: 0 })
  return Promise.resolve()
}

function sessionsOf (event: SessionEvent): Map<string, SessionEntry> {
  let sessions = sessionCache.get(event)
  if (!sessions) {
    sessions = new Map()
    sessionCache.set(event, sessions)
  }
  return sessions
}

async function unsealSession<T extends SessionData> (sealed: string, config: SessionConfig): Promise<Session<T> | undefined> {
  const password = await resolvePassword(config)
  const unsealed = await unseal(sealed, password, {
    ttl: config.maxAge ? config.maxAge * 1000 : 0,
  }).catch(() => undefined) as Session<T> | undefined
  if (unsealed && typeof unsealed.id === 'string' && unsealed.data) {
    return unsealed
  }
}

async function sealSession (event: SessionEvent, config: SessionConfig, session: Session<any>): Promise<void> {
  const name = config.name ?? DEFAULT_NAME
  const sealed = await seal(session, await resolvePassword(config), {
    ttl: config.maxAge ? config.maxAge * 1000 : 0,
  })

  const options = cookieOptions(config)
  const size = serialize(name, sealed, options).length
  if (size > MAX_COOKIE_BYTES) {
    throw createError({
      status: 500,
      message: `Session cookie \`${name}\` is ${size} bytes, over the ${MAX_COOKIE_BYTES} byte limit browsers accept. Store less in the session, or keep the data server-side and reference it by id.`,
    })
  }

  setSessionCookie(event, name, sealed, options)
}

/** One `Set-Cookie` per session name, however often it is written in a request. */
function setSessionCookie (event: SessionEvent, name: string, value: string, options: CookieSerializeOptions): void {
  const prefix = `${name}=`
  const others = event.res.headers.getSetCookie().filter(cookie => !cookie.startsWith(prefix))
  event.res.headers.delete('set-cookie')
  for (const cookie of others) {
    event.res.headers.append('set-cookie', cookie)
  }
  setCookie(event, name, value, options)
}

function resolvePassword (config: SessionConfig): Promise<SessionPassword> {
  return config.password === undefined
    ? deriveSecret(`nuxt-session:${config.name ?? DEFAULT_NAME}`)
    : Promise.resolve(config.password)
}

function cookieOptions (config: SessionConfig): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    ...(config.maxAge ? { maxAge: config.maxAge } : {}),
    ...config.cookie,
  }
}
