import type { Ref, WatchHandle } from 'vue'
import { customRef, getCurrentScope, onScopeDispose, ref, unref, watch } from 'vue'
import { parse, parseSetCookie, serialize } from 'cookie-es'
import type { CookieSerializeOptions } from '../types/cookie'
import type { NuxtRequestEvent } from '@nuxt/schema'
import { isEqual } from 'ohash'
import { klona } from 'klona'
import type { NuxtApp } from '../nuxt'
import { tryUseNuxtApp, useNuxtApp } from '../nuxt'
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

type _CookieOptions = Omit<CookieSerializeOptions, 'encode'>

export interface CookieOptions<T = any> extends _CookieOptions {
  decode?(value: string | null | undefined): T
  encode?(value: T): string
  default?: () => T | Ref<T>
}

/** Options accepted by `useCookie`. */
export interface UseCookieOptions<T = any> extends Omit<CookieOptions<T>, 'expires'> {
  /**
   * Expiration date for the cookie, or a getter that returns one.
   *
   * When a function is provided, it is evaluated on every cookie write
   * so the expiration can be refreshed when the value is re-set.
   * The getter should be pure (no side effects).
   */
  expires?: Date | (() => Date | undefined)
  watch?: boolean | 'shallow'
  readonly?: boolean
  /** Whether this ref reads the named cookie from the jar. Defaults to an exact name match. */
  filter?(key: string): boolean

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
  /** A `$cookie` instance whose defaults this ref uses, e.g. from `$cookie.create()`. */
  $cookie?: $Cookie<T>
}

function resolveExpires (expires?: Date | (() => Date | undefined)): Date | undefined {
  return typeof expires === 'function' ? expires() : expires
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CookieRef<T> extends Ref<T> {}

function decodeURIComponentSafe (value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const baseCookieOptions = {
  path: '/',
  decode: val => val ? decodeURIComponentSafe(val) : val,
  encode: val => encodeURIComponent(val),
} satisfies CookieOptions<any>

/**
 * The serializer `useCookie` used by default before Nuxt 5: values are stored as JSON, except
 * strings that would not be read back as strings.
 *
 * @deprecated todo link to docs
 *
 * @since 5.0.0
 */
export const legacyCookieSerializer = {
  decode: (val: string | null | undefined): any => val ? parseCookieValue(decodeURIComponent(val)) : val,
  encode: (val: any): string => {
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
} satisfies Pick<CookieOptions, 'encode' | 'decode'>

// we use globalThis to avoid crashes in web workers
const store = import.meta.client && cookieStore ? globalThis.cookieStore : undefined

/** A `useCookie` composable whose value type defaults to `D`, as returned by `createUseCookie`. */
export interface UseCookie<D = string | null | undefined> {
  <T = D> (name: string, opts?: UseCookieOptions<T> & { readonly?: false }): CookieRef<T>
  <T = D> (name: string, opts: UseCookieOptions<T> & { readonly: true }): Readonly<CookieRef<T>>
}

/** @since 3.0.0 */
export function useCookie<T = string | null | undefined> (name: string, _opts?: UseCookieOptions<T> & { readonly?: false }): CookieRef<T>
export function useCookie<T = string | null | undefined> (name: string, _opts: UseCookieOptions<T> & { readonly: true }): Readonly<CookieRef<T>>
export function useCookie<T = string | null | undefined> (name: string, _opts?: UseCookieOptions<T>): CookieRef<T> {
  const instance: $Cookie<any> = _opts?.$cookie ?? $cookie
  const opts = { watch: true, refresh: false, ...baseCookieOptions, ...instance.options, ..._opts }
  opts.filter ??= key => key === name

  const nuxtApp = import.meta.server ? useNuxtApp() : undefined!

  const hasCookie = opts.filter(name) && instance.has(name)
  const cookies: Record<string, unknown> = { [name]: hasCookie ? instance.get(name, { ...opts, default: undefined } as CookieOptions) : undefined }

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
  const shouldSetInitialClientCookie = import.meta.client && !opts.readonly && (hasExpired || cookieValueIsNullish) && !(!hasCookie && cookieValueIsNullish && opts.default === undefined)
  const cookieValue = klona(hasExpired ? undefined : (cookies[name] as any) ?? opts.default?.())

  // use a custom ref to expire the cookie on client side otherwise use a plain ref (or cookieServerRef on the server to track writes for the `refresh` option)
  const cookie = import.meta.client && (typeof opts.expires === 'function' || (delay && !hasExpired))
    ? cookieRef<T | undefined>(cookieValue, delay, getDelay, opts.watch && opts.watch !== 'shallow')
    : import.meta.server
      ? cookieServerRef<T | undefined>(name, cookieValue, opts, nuxtApp)
      : ref<T | undefined>(cookieValue)

  if (import.meta.server && !opts.readonly && !hasCookie) {
    const initialValue = cookie.value
    if (initialValue !== undefined && initialValue !== null) {
      updateServerCookieJar(nuxtApp, name, opts.encode(initialValue as T))
    }
  }

  if (import.meta.dev && hasExpired) {
    reportExpiredCookie(name)
  }

  if (import.meta.client) {
    let skipRefresh = false
    const callback = (force = false) => {
      if (!force) {
        if (opts.readonly || isEqual(cookie.value, cookies[name])) { return }
      }
      instance.set(name, cookie.value, opts as CookieOptions)
      cookies[name] = klona(cookie.value)
    }

    let cookieWatcher: WatchHandle | undefined

    const handleChange = (value: T | undefined) => {
      if (!opts.filter!(name)) { value = undefined }
      if (isEqual(value, cookie.value)) { return }
      cookie.value = value
      cookies[name] = klona(value)
      skipRefresh = true
    }

    instance.onChange(name, handleChange, opts as CookieOptions)
    const hasScope = !!getCurrentScope()

    if (hasScope) {
      const app = tryUseNuxtApp()
      const writers = app && (app._cookieWriters ||= new Set())
      const write = () => callback()
      writers?.add(write)
      onScopeDispose(() => {
        writers?.delete(write)
        cookieWatcher?.pause()
        callback()
      })
    }

    if (opts.watch && !opts.readonly) {
      cookieWatcher = watch(cookie, () => {
        const force = opts.refresh && !skipRefresh
        skipRefresh = false
        callback(force)
      }, { deep: opts.watch !== 'shallow' })
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
      nuxtApp.runWithContext(() => instance.set(name, cookie.value, opts as CookieOptions))
    }
    const unhook = nuxtApp.hooks.hookOnce('app:rendered', writeFinalCookieValue)
    nuxtApp.hooks.hookOnce('app:error', () => {
      unhook() // don't write cookie subsequently when app:rendered is called
      return writeFinalCookieValue()
    })
  }

  return cookie as CookieRef<T>
}

/**
 * Create a `useCookie` composable with default options, e.g. `createUseCookie(legacyCookieSerializer)`.
 *
 * @since 5.0.0
 */
export function createUseCookie<D = string | null | undefined> (defaults: UseCookieOptions<D> = {}): UseCookie<D> {
  return ((name: string, opts?: UseCookieOptions) => useCookie(name, { ...defaults, ...opts } as UseCookieOptions & { readonly?: false })) as UseCookie<D>
}

/** @since 3.10.0 */
export function refreshCookie (name: string): void {
  if (import.meta.server) { return }
  broadcastCookie(name, { refresh: true })
}

function broadcastCookie (name: string, data: { value?: string, refresh?: boolean }) {
  if (store || typeof BroadcastChannel === 'undefined') { return }

  try {
    const channel = new BroadcastChannel(`nuxt:cookies:${name}`)
    channel.postMessage(data)
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
function isWriteVisibleToDocument (opts: UseCookieOptions) {
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
const reportedExpiredCookies = /* @__PURE__ */ new Set<string>()
function reportExpiredCookie (name: string) {
  if (reportedExpiredCookies.has(name)) { return }
  reportedExpiredCookies.add(name)
  stateDiagnostics.NUXT_E7005({ name })
}

function isExpiredWrite (opts: UseCookieOptions) {
  if (opts.maxAge !== undefined) { return opts.maxAge <= 0 }
  const expires = resolveExpires(opts.expires)
  return expires !== undefined && expires.getTime() <= Date.now()
}

function updateClientCookieJar (name: string, value: string | undefined, opts: UseCookieOptions) {
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

function toSerializeOptions (opts: UseCookieOptions): CookieSerializeOptions {
  const { encode: _encode, decode: _decode, expires, ...rest } = opts
  return {
    ...rest,
    expires: resolveExpires(expires),
    encode: identity,
  }
}

function serializeCookie (name: string, value: string | undefined, opts: UseCookieOptions = {}) {
  const serializeOpts = toSerializeOptions(opts)
  if (value === undefined) {
    return serialize(name, '', { ...serializeOpts, maxAge: -1 })
  }
  return serialize(name, value, serializeOpts)
}

function writeClientCookie (name: string, value: string | undefined, opts: UseCookieOptions = {}) {
  if (import.meta.client) {
    document.cookie = serializeCookie(name, value, opts)
    updateClientCookieJar(name, value, opts)
  }
}

function writeServerCookie (event: NuxtRequestEvent, name: string, value: string | undefined, opts: UseCookieOptions = {}) {
  if (event) {
    const serializeOpts = toSerializeOptions(opts)
    // update if value is set
    if (value !== undefined) {
      return setResponseCookie(event, name, value, serializeOpts)
    }

    // delete if cookie exists in browser, or was set earlier in the response, and value is null/undefined
    if (parse(event.req.headers.get('cookie') || '')[name] !== undefined || responseSetsCookie(event, name)) {
      return setResponseCookie(event, name, '', { ...serializeOpts, maxAge: 0 })
    }

    // else ignore if cookie doesn't exist in browser and value is null/undefined
  }
}

function responseSetsCookie (event: NuxtRequestEvent, name: string) {
  for (const raw of event.res.headers.getSetCookie()) {
    if (parseSetCookie(raw, { decode: false })?.name === name) { return true }
  }
  return false
}

// cookies are distinct per name, domain and path, so only a cookie matching all three is replaced
function cookieKey (name: string, opts: { domain?: string, path?: string }) {
  return [name, (opts.domain || '').replace(/^\./, '').toLowerCase(), opts.path || '/'].join(';')
}

function setResponseCookie (event: NuxtRequestEvent, name: string, value: string, opts: CookieSerializeOptions) {
  const newCookie = serialize(name, value, { path: '/', ...opts })
  const currentCookies = event.res.headers.getSetCookie()

  if (currentCookies.length === 0) {
    event.res.headers.set('set-cookie', newCookie)
    return
  }

  const namePrefix = `${name}=`
  if (!currentCookies.some(cookie => cookie.startsWith(namePrefix))) {
    event.res.headers.append('set-cookie', newCookie)
    return
  }

  const newCookieKey = cookieKey(name, opts)
  event.res.headers.delete('set-cookie')
  for (const cookie of currentCookies) {
    const parsed = parseSetCookie(cookie)
    const isReplaced = parsed ? cookieKey(parsed.name, parsed) === newCookieKey : cookie.startsWith(namePrefix)
    if (isReplaced) { continue }
    event.res.headers.append('set-cookie', cookie)
  }
  event.res.headers.append('set-cookie', newCookie)
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
function cookieServerRef<T> (name: string, value: T | undefined, opts: UseCookieOptions<any> & { encode: (value: any) => string }, nuxtApp: NuxtApp) {
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

export interface $Cookie<D = string | null | undefined> {
  /** The defaults this instance was created with. */
  readonly options: CookieOptions<D>
  get<T = D> (name: string, opts: CookieOptions<T> & { default: () => T | Ref<T> }): T
  get<T = D> (name: string, opts?: CookieOptions<T>): T | undefined
  /** Read and decode all cookies visible to the current request (server) or document (client). */
  getAll<T = D> (opts?: CookieOptions<T>): Record<string, T | undefined>
  has (name: string): boolean
  /** Encode and write a cookie. Setting `null` or `undefined` removes it. */
  set<T = D> (name: string, value: NoInfer<T> | null | undefined, opts?: CookieOptions<T>): void
  /** Remove a cookie. Pass the same `path`/`domain` the cookie was set with. */
  remove (name: string, opts?: CookieOptions): void
  /**
   * Call `callback` with the decoded value whenever the cookie changes, including in other tabs.
   * Returns a function that stops listening, which is also called when the current effect scope
   * is disposed or `signal` is aborted. Does nothing on the server.
   */
  onChange<T = D> (name: string, callback: (value: T | undefined) => void, opts?: CookieOptions<T> & { signal?: AbortSignal }): () => void
  create<T = D> (defaults?: CookieOptions<T>): $Cookie<T>
}

function readCookieJar (): Record<string, string | undefined> {
  return import.meta.client ? readClientCookieJar() : readServerCookieJar(useNuxtApp())
}

function listen (name: string, callback: (value: any) => void, opts: CookieOptions) {
  const { decode = baseCookieOptions.decode } = opts
  const handleChange = (data: { value?: string | null, refresh?: boolean }) => {
    if (data.refresh) { invalidateClientCookieJar() }
    const raw = data.refresh ? readClientCookieJar()[name] : data.value
    callback(raw === undefined && data.refresh ? undefined : decode(raw))
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
    return () => store.removeEventListener('change', changeHandler)
  }

  let channel: BroadcastChannel | undefined
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(`nuxt:cookies:${name}`)
    }
  } catch {
    // BroadcastChannel will fail in certain situations when cookies are disabled
    // or running in an iframe: see https://github.com/nuxt/nuxt/issues/26338
  }
  if (!channel) { return () => {} }
  channel.onmessage = ({ data }) => handleChange(data)
  return () => channel.close()
}

function createCookieUtil (defaults: CookieOptions): $Cookie<any> {
  const read = (raw: string | undefined, opts?: CookieOptions) => {
    const { decode = baseCookieOptions.decode, default: getDefault } = { ...defaults, ...opts }
    const value = raw === undefined ? undefined : decode(raw)
    return value ?? (getDefault ? unref(getDefault()) : value)
  }

  const write = (name: string, value: unknown, opts?: CookieOptions) => {
    const { encode = baseCookieOptions.encode, default: _default, ...options } = { ...defaults, ...opts }
    const encoded = value === null || value === undefined ? undefined : encode(value)
    const writeOpts = { path: baseCookieOptions.path, ...options }

    if (import.meta.dev && encoded !== undefined && isExpiredWrite(writeOpts)) {
      reportExpiredCookie(name)
    }

    if (import.meta.client) {
      writeClientCookie(name, encoded, writeOpts)
      broadcastCookie(name, { value: isExpiredWrite(writeOpts) ? undefined : encoded })
    } else {
      const nuxtApp = useNuxtApp()
      writeServerCookie(useRequestEvent(nuxtApp)!, name, encoded, writeOpts)
      updateServerCookieJar(nuxtApp, name, encoded)
    }
  }

  return {
    options: defaults,
    get: (name: string, opts?: CookieOptions) => read(readCookieJar()[name], opts),
    getAll (opts) {
      const jar = readCookieJar()
      const result: Record<string, any> = {}
      for (const name in jar) {
        result[name] = read(jar[name], opts)
      }
      return result
    },
    has: name => readCookieJar()[name] !== undefined,
    set: (name, value, opts) => write(name, value, opts),
    remove: (name, opts) => write(name, undefined, opts),
    onChange (name, callback, opts) {
      if (!import.meta.client || opts?.signal?.aborted) { return () => {} }
      const { signal, ...options } = opts ?? {}
      const unlisten = listen(name, callback, { ...defaults, ...options })
      const stop = () => {
        unlisten()
        signal?.removeEventListener('abort', stop)
      }
      signal?.addEventListener('abort', stop, { once: true })
      if (getCurrentScope()) { onScopeDispose(stop) }
      return stop
    },
    create: opts => createCookieUtil({ ...defaults, ...opts }),
  }
}

/**
 * Read and write cookies imperatively, on both server and client.
 *
 * @since 5.0.0
 */
export const $cookie: $Cookie = /* @__PURE__ */ createCookieUtil(baseCookieOptions)
