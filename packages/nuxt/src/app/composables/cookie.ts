import type { Ref, WatchHandle } from 'vue'
import { customRef, getCurrentScope, nextTick, onScopeDispose, ref, watch } from 'vue'
import type { CookieParseOptions, CookieSerializeOptions } from 'cookie-es'
import { parse, parseSetCookie, serialize } from 'cookie-es'
import { deleteCookie, getCookie, setCookie } from '@nuxt/nitro-server/h3'
import type { H3Event } from '@nuxt/nitro-server/h3'
import { isEqual } from 'ohash'
import { klona } from 'klona'
import type { NuxtApp } from '../nuxt'
import { useNuxtApp } from '../nuxt'
import { useRequestEvent } from './ssr'
import { stateDiagnostics } from '../diagnostics/state'

import { cookieStore } from '#build/nuxt.config.mjs'

function parseCookieValue (value: string) {
  if (value === 'undefined') { return undefined }
  try {
    const parsed = JSON.parse(value)
    // avoid coercing number-like strings that lose precision or overflow (e.g. '4e71375682906041' -> Infinity)
    if (typeof parsed === 'number' && String(parsed) !== value) { return value }
    return parsed
  } catch { return value }
}

type _CookieOptions = Omit<CookieSerializeOptions & CookieParseOptions, 'decode' | 'encode' | 'expires'>

export interface CookieOptions<T = any> extends _CookieOptions {
  decode?(value: string | null | undefined): T
  encode?(value: T): string
  default?: () => T | Ref<T>
  watch?: boolean | 'shallow'
  readonly?: boolean

  /**
   * Expiration date for the cookie, or a getter that returns one.
   *
   * When a function is provided, it is evaluated on every cookie write
   * so the expiration can be refreshed when the value is re-set.
   * The getter should be pure (no side effects).
   */
  expires?: Date | (() => Date | undefined)

  /**
   * Refresh cookie expiration even when the value remains unchanged.
   *
   * By default, a cookie is only rewritten when its value changes.
   * When `refresh` is set to `true`, the cookie will be re-written
   * on every explicit assignment (e.g. `cookie.value = cookie.value`),
   * extending its expiration even if the value is the same.
   *
   * Note: the expiration is not refreshed automatically — you must
   * assign to `cookie.value` to trigger the refresh.
   *
   * Ignored when `readonly` is set.
   *
   * @default false
   */
  refresh?: boolean
}

function resolveExpires (expires?: Date | (() => Date | undefined)): Date | undefined {
  return typeof expires === 'function' ? expires() : expires
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CookieRef<T> extends Ref<T> {}

const CookieDefaults = {
  path: '/',
  watch: true,
  decode: val => val ? parseCookieValue(decodeURIComponent(val)) : val,
  encode: (val) => {
    // JSON-quote strings that would be coerced on decode (e.g. '42', 'true', 'null', 'undefined')
    if (typeof val !== 'string' || val === 'undefined') {
      return encodeURIComponent(JSON.stringify(val))
    }

    try {
      if (typeof JSON.parse(val) !== 'string') {
        return encodeURIComponent(JSON.stringify(val))
      }
    } catch {
      // ignore - value is not JSON, so encode as-is
    }
    return encodeURIComponent(val)
  },
  refresh: false,
} satisfies CookieOptions<any>

// we use globalThis to avoid crashes in web workers
const store = import.meta.client && cookieStore ? globalThis.cookieStore : undefined

/** @since 3.0.0 */
export function useCookie<T = string | null | undefined> (name: string, _opts?: CookieOptions<T> & { readonly?: false }): CookieRef<T>
export function useCookie<T = string | null | undefined> (name: string, _opts: CookieOptions<T> & { readonly: true }): Readonly<CookieRef<T>>
export function useCookie<T = string | null | undefined> (name: string, _opts?: CookieOptions<T>): CookieRef<T> {
  const opts = { ...CookieDefaults, ..._opts }
  opts.filter ??= key => key === name

  const nuxtApp = import.meta.server ? useNuxtApp() : undefined!

  const jar = import.meta.client ? readClientCookieJar() : readServerCookieJar(nuxtApp)
  const rawValue = opts.filter(name) ? jar[name] : undefined
  const cookies: Record<string, unknown> = { [name]: rawValue === undefined ? undefined : opts.decode(rawValue) }

  let delay: number | undefined

  if (opts.maxAge !== undefined) {
    delay = opts.maxAge * 1000 // convert to ms for setTimeout
  } else if (opts.expires) {
    const expires = resolveExpires(opts.expires)
    if (expires) {
      // getTime() already returns time in ms
      delay = expires.getTime() - Date.now()
    }
  }

  const getDelay = () => {
    if (opts.maxAge !== undefined) { return opts.maxAge * 1000 }
    if (!opts.expires) { return undefined }
    const expires = resolveExpires(opts.expires)
    return expires ? expires.getTime() - Date.now() : undefined
  }

  const hasExpired = delay !== undefined && delay <= 0
  const cookieValueIsNullish = cookies[name] === undefined || cookies[name] === null
  const shouldSetInitialClientCookie = import.meta.client && !opts.readonly && (hasExpired || cookieValueIsNullish) && !(rawValue === undefined && cookieValueIsNullish && opts.default === undefined)
  const cookieValue = klona(hasExpired ? undefined : (cookies[name] as any) ?? opts.default?.())

  // use a custom ref to expire the cookie on client side otherwise use a plain ref (or cookieServerRef on the server to track writes for the `refresh` option)
  const cookie = import.meta.client && (typeof opts.expires === 'function' || (delay && !hasExpired))
    ? cookieRef<T | undefined>(cookieValue, delay, getDelay, opts.watch && opts.watch !== 'shallow')
    : import.meta.server
      ? cookieServerRef<T | undefined>(name, cookieValue, opts, nuxtApp)
      : ref<T | undefined>(cookieValue)

  if (import.meta.server && !opts.readonly && rawValue === undefined) {
    const initialValue = cookie.value
    if (initialValue !== undefined && initialValue !== null) {
      updateServerCookieJar(nuxtApp, name, opts.encode(initialValue as T))
    }
  }

  if (import.meta.dev && hasExpired) {
    stateDiagnostics.NUXT_E7005({ name })
  }

  if (import.meta.client) {
    let channel: null | BroadcastChannel = null
    try {
      if (!store && typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(`nuxt:cookies:${name}`)
      }
    } catch {
      // BroadcastChannel will fail in certain situations when cookies are disabled
      // or running in an iframe: see https://github.com/nuxt/nuxt/issues/26338
    }
    const callback = (force = false) => {
      if (!force) {
        if (opts.readonly || isEqual(cookie.value, cookies[name])) { return }
      }
      const encoded = cookie.value === null || cookie.value === undefined
        ? undefined
        : opts.encode(cookie.value as T)
      writeClientCookie(name, encoded, opts)

      cookies[name] = klona(cookie.value)
      channel?.postMessage({ value: opts.encode(cookie.value as T) })
    }

    let cookieWatcher: WatchHandle | undefined

    const handleChange = (data: { value?: string | null, refresh?: boolean }) => {
      if (data.refresh) { invalidateClientCookieJar() }
      const raw = data.refresh ? (opts.filter!(name) ? readClientCookieJar()[name] : undefined) : data.value
      const value = raw === undefined && data.refresh ? undefined : opts.decode(raw)
      cookieWatcher?.pause()
      cookie.value = value
      cookies[name] = klona(value)
      nextTick(() => cookieWatcher?.resume())
    }

    const hasScope = !!getCurrentScope()

    if (hasScope) {
      onScopeDispose(() => {
        cookieWatcher?.pause()
        callback()
        channel?.close()
      })
    }

    if (store) {
      /* event is of type CookieChangeEvent */
      const changeHandler = (event: CookieChangeEvent) => {
        const changedCookie = event.changed.find(c => c.name === name)
        const removedCookie = event.deleted.find(c => c.name === name)

        if (changedCookie) {
          handleChange({ value: changedCookie.value })
        }

        if (removedCookie) {
          handleChange({ value: null })
        }
      }
      store.addEventListener('change', changeHandler)
      if (hasScope) {
        onScopeDispose(() => store.removeEventListener('change', changeHandler))
      }
    } else if (channel) {
      channel.onmessage = ({ data }) => handleChange(data)
    }

    if (opts.watch && !opts.readonly) {
      cookieWatcher = watch(cookie, () => callback(opts.refresh), { deep: opts.watch !== 'shallow' })
    }

    if (shouldSetInitialClientCookie) {
      callback(shouldSetInitialClientCookie)
    }
  } else if (import.meta.server) {
    const writeFinalCookieValue = () => {
      const valueIsSame = isEqual(cookie.value, cookies[name])

      if (
        opts.readonly
        || (valueIsSame && !opts.refresh)
      ) { return }

      nuxtApp._cookiesChanged ||= {}
      if (valueIsSame && opts.refresh && !nuxtApp._cookiesChanged[name]) {
        return
      }

      nuxtApp._cookies ||= {}
      if (name in nuxtApp._cookies) {
        // do not append a second `set-cookie` header
        if (isEqual(cookie.value, nuxtApp._cookies[name])) { return }
        // warn in dev mode
        if (import.meta.dev) {
          stateDiagnostics.NUXT_E7006({ name, previous: opts.encode(nuxtApp._cookies[name] as any), next: opts.encode(cookie.value as any) })
        }
      }
      nuxtApp._cookies[name] = cookie.value
      const encoded = cookie.value === null || cookie.value === undefined
        ? undefined
        : opts.encode(cookie.value as T)
      writeServerCookie(useRequestEvent(nuxtApp)!, name, encoded, opts)
    }
    const unhook = nuxtApp.hooks.hookOnce('app:rendered', writeFinalCookieValue)
    nuxtApp.hooks.hookOnce('app:error', () => {
      unhook() // don't write cookie subsequently when app:rendered is called
      return writeFinalCookieValue()
    })
  }

  return cookie as CookieRef<T>
}
/** @since 3.10.0 */
export function refreshCookie (name: string): void {
  if (import.meta.server || store || typeof BroadcastChannel === 'undefined') { return }

  try {
    const channel = new BroadcastChannel(`nuxt:cookies:${name}`)
    channel.postMessage({ refresh: true })
    channel.close()
  } catch {
    // BroadcastChannel will fail in certain situations when cookies are disabled
    // or running in an iframe: see https://github.com/nuxt/nuxt/issues/26338
  }
}

/**
 * Cache of the raw (undecoded) cookie jar, populated only on the client.
 *
 * The cache is dropped on the next microtask to keep it accurate.
 */
let clientCookieJar: Record<string, string | undefined> | undefined

function invalidateClientCookieJar () {
  if (import.meta.client) {
    clientCookieJar = undefined
  }
}

function readClientCookieJar () {
  if (import.meta.client && !clientCookieJar) {
    clientCookieJar = parse(document.cookie, { decode: identity })
    queueMicrotask(invalidateClientCookieJar)
  }
  return clientCookieJar || {}
}

/**
 * Cookie attributes that mean the value we just wrote will not necessarily be
 * readable back from `document.cookie` on the current document, either because
 * the browser rejects the write or because it is scoped elsewhere.
 */
function isWriteVisibleToDocument (opts: CookieOptions) {
  // a partitioned cookie is readable from the partition that set it, so it is not excluded here
  if (opts.domain || opts.httpOnly) { return false }
  if (opts.secure && location.protocol !== 'https:') { return false }
  if (opts.sameSite === 'none' && !opts.secure) { return false }
  return opts.path === undefined || isCurrentPath(opts.path)
}

// cookie path matching, per RFC 6265 section 5.1.4
function isCurrentPath (path: string) {
  const { pathname } = location
  if (pathname === path) { return true }
  if (!pathname.startsWith(path)) { return false }
  return path.endsWith('/') || pathname[path.length] === '/'
}

/**
 * A write with a non-positive `maxAge` or a past `expires` date deletes the
 * cookie in the browser regardless of the value passed alongside it.
 */
function isExpiredWrite (opts: CookieOptions) {
  if (opts.maxAge !== undefined) { return opts.maxAge <= 0 }
  const expires = resolveExpires(opts.expires)
  return expires !== undefined && expires.getTime() <= Date.now()
}

function updateClientCookieJar (name: string, value: string | undefined, opts: CookieOptions) {
  if (!clientCookieJar) { return }

  if (!isWriteVisibleToDocument(opts)) {
    return invalidateClientCookieJar()
  }

  if (value === undefined || isExpiredWrite(opts)) {
    delete clientCookieJar[name]
  } else {
    clientCookieJar[name] = value
  }
}

/**
 * Cookie jar for the current request, seeded from the incoming `cookie` header.
 *
 * @see https://github.com/nuxt/nuxt/issues/22631
 */
function readServerCookieJar (nuxtApp: NuxtApp): Record<string, string | undefined> {
  const event = useRequestEvent(nuxtApp)!
  const jar = nuxtApp._cookieJar ??= parse(event.req.headers.get('cookie') || '', { decode: identity })

  // overlay cookies set on the event outside `useCookie`, e.g. with h3's `setCookie` in server middleware
  const setCookies = event.res.headers.getSetCookie()
  for (let i = nuxtApp._appliedSetCookies || 0; i < setCookies.length; i++) {
    const cookie = parseSetCookie(setCookies[i]!, { decode: false })
    if (!cookie) { continue }
    if ((cookie.maxAge !== undefined && cookie.maxAge <= 0) || (cookie.expires && cookie.expires.getTime() <= Date.now())) {
      delete jar[cookie.name]
    } else {
      jar[cookie.name] = cookie.value
    }
  }
  nuxtApp._appliedSetCookies = setCookies.length

  return jar
}

function updateServerCookieJar (nuxtApp: NuxtApp, name: string, value: string | undefined) {
  const jar = readServerCookieJar(nuxtApp)
  if (value === undefined) {
    delete jar[name]
  } else {
    jar[name] = value
  }
}

// value is expected to be already encoded via `opts.encode`; pass through as-is
const identity = (val: string) => val

function toSerializeOptions (opts: CookieOptions): CookieSerializeOptions {
  const { encode: _encode, decode: _decode, expires, ...rest } = opts
  return {
    ...rest,
    expires: resolveExpires(expires),
    encode: identity,
  }
}

function serializeCookie (name: string, value: string | undefined, opts: CookieOptions = {}) {
  const serializeOpts = toSerializeOptions(opts)
  if (value === undefined) {
    return serialize(name, '', { ...serializeOpts, maxAge: -1 })
  }
  return serialize(name, value, serializeOpts)
}

function writeClientCookie (name: string, value: string | undefined, opts: CookieOptions = {}) {
  if (import.meta.client) {
    document.cookie = serializeCookie(name, value, opts)
    updateClientCookieJar(name, value, opts)
  }
}

function writeServerCookie (event: H3Event, name: string, value: string | undefined, opts: CookieOptions = {}) {
  if (event) {
    const serializeOpts = toSerializeOptions(opts)
    // update if value is set
    if (value !== undefined) {
      return setCookie(event, name, value, serializeOpts)
    }

    // delete if cookie exists in browser, or was set earlier in the response, and value is null/undefined
    if (getCookie(event, name) !== undefined || responseSetsCookie(event, name)) {
      return deleteCookie(event, name, serializeOpts)
    }

    // else ignore if cookie doesn't exist in browser and value is null/undefined
  }
}

function responseSetsCookie (event: H3Event, name: string) {
  for (const raw of event.res.headers.getSetCookie()) {
    if (parseSetCookie(raw, { decode: false })?.name === name) { return true }
  }
  return false
}

/**
 * The maximum value allowed on a timeout delay.
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#maximum_delay_value
 */
const MAX_TIMEOUT_DELAY = 2_147_483_647

// custom ref that will update the value to undefined if the cookie expires
function cookieRef<T> (value: T | undefined, initialDelay: number | undefined, getDelay: () => number | undefined, shouldWatch: boolean) {
  let timeout: NodeJS.Timeout
  let unsubscribe: (() => void) | undefined
  let elapsed = 0
  let delay = initialDelay
  const internalRef = shouldWatch ? ref(value) : { value }
  if (getCurrentScope()) {
    onScopeDispose(() => {
      unsubscribe?.()
      clearTimeout(timeout)
    })
  }

  return customRef((track, trigger) => {
    if (shouldWatch) { unsubscribe = watch(internalRef, trigger) }

    function scheduleTimeout () {
      const currentDelay = delay
      if (currentDelay === undefined) { return }
      const timeRemaining = currentDelay - elapsed
      const timeoutLength = timeRemaining < MAX_TIMEOUT_DELAY ? timeRemaining : MAX_TIMEOUT_DELAY
      timeout = setTimeout(() => {
        elapsed += timeoutLength
        if (elapsed < currentDelay) { return scheduleTimeout() }

        internalRef.value = undefined
        trigger()
      }, timeoutLength)
    }

    function createExpirationTimeout () {
      elapsed = 0
      delay = getDelay()
      clearTimeout(timeout)
      scheduleTimeout()
    }

    return {
      get () {
        track()
        return internalRef.value
      },
      set (newValue) {
        createExpirationTimeout()

        internalRef.value = newValue
        trigger()
      },
    }
  })
}

/**
 * Custom ref that tracks explicit cookie writes on the server.
 *
 * This is required for the `refresh` option to ensure the cookie is
 * re-written on SSR even when the value remains unchanged.
 */
function cookieServerRef<T> (name: string, value: T | undefined, opts: CookieOptions<any> & { encode: (value: any) => string }, nuxtApp: NuxtApp) {
  const internalRef = ref(value)

  return customRef((track, trigger) => {
    return {
      get () {
        track()
        return internalRef.value
      },
      set (newValue) {
        nuxtApp._cookiesChanged ||= {}
        nuxtApp._cookiesChanged[name] = true

        if (!opts.readonly) {
          updateServerCookieJar(nuxtApp, name, newValue === null || newValue === undefined ? undefined : opts.encode(newValue))
        }

        internalRef.value = newValue
        trigger()
      },
    }
  })
}
