import type { Ref } from 'vue'
import { getCurrentScope, nextTick, onScopeDispose, ref, watch } from 'vue'
import type { CookieParseOptions, CookieSerializeOptions } from 'cookie-es'
import { parse, serialize } from 'cookie-es'
import { deleteCookie, getCookie, getRequestHeader, setCookie } from 'h3'
import type { H3Event } from 'h3'
import destr from 'destr'
import { isEqual } from 'ohash'
import { useNuxtApp } from '../nuxt'
import { useRequestEvent } from './ssr'

type _CookieOptions = Omit<CookieSerializeOptions & CookieParseOptions, 'decode' | 'encode'>

export interface CookieOptions<T = any> extends _CookieOptions {
  decode?(value: string): T
  encode?(value: T): string
  default?: () => T | Ref<T>
  watch?: boolean | 'shallow'
}

export interface CookieRef<T> extends Ref<T> {}

const CookieDefaults = {
  path: '/',
  watch: true,
  decode: val => destr(decodeURIComponent(val)),
  encode: val => encodeURIComponent(typeof val === 'string' ? val : JSON.stringify(val))
} satisfies CookieOptions<any>

export function useCookie<T = string | null | undefined> (name: string, _opts?: CookieOptions<T>): CookieRef<T> {
  const opts = { ...CookieDefaults, ..._opts }
  const cookies = readRawCookies(opts) || {}

  const cookie = ref<T | undefined>(cookies[name] as any ?? opts.default?.())

  if (import.meta.client) {
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`nuxt:cookies:${name}`)
    if (getCurrentScope()) { onScopeDispose(() => { channel?.close() }) }

    const callback = () => {
      writeClientCookie(name, cookie.value, opts as CookieSerializeOptions)
      channel?.postMessage(opts.encode(cookie.value as T))
    }

    let watchPaused = false

    if (channel) {
      channel.onmessage = (event) => {
        watchPaused = true
        cookie.value = opts.decode(event.data)
        nextTick(() => { watchPaused = false })
      }
    }

    if (opts.watch) {
      watch(cookie, () => {
        if (watchPaused) { return }
        callback()
      },
      { deep: opts.watch !== 'shallow' })
    } else {
      callback()
    }
  } else if (import.meta.server) {
    const nuxtApp = useNuxtApp()
    const writeFinalCookieValue = () => {
      if (!isEqual(cookie.value, cookies[name])) {
        writeServerCookie(useRequestEvent(nuxtApp), name, cookie.value, opts as CookieOptions<any>)
      }
    }
    const unhook = nuxtApp.hooks.hookOnce('app:rendered', writeFinalCookieValue)
    nuxtApp.hooks.hookOnce('app:error', () => {
      unhook() // don't write cookie subsequently when app:rendered is called
      return writeFinalCookieValue()
    })
  }

  return cookie as CookieRef<T>
}

function readRawCookies (opts: CookieOptions = {}): Record<string, string> | undefined {
  if (import.meta.server) {
    return parse(getRequestHeader(useRequestEvent(), 'cookie') || '', opts)
  } else if (import.meta.client) {
    return parse(document.cookie, opts)
  }
}

function serializeCookie (name: string, value: any, opts: CookieSerializeOptions = {}) {
  if (value === null || value === undefined) {
    return serialize(name, value, { ...opts, maxAge: -1 })
  }
  return serialize(name, value, opts)
}

function writeClientCookie (name: string, value: any, opts: CookieSerializeOptions = {}) {
  if (import.meta.client) {
    document.cookie = serializeCookie(name, value, opts)
  }
}

function writeServerCookie (event: H3Event, name: string, value: any, opts: CookieSerializeOptions = {}) {
  if (event) {
    // update if value is set
    if (value !== null && value !== undefined) {
      return setCookie(event, name, value, opts)
    }

    // delete if cookie exists in browser and value is null/undefined
    if (getCookie(event, name) !== undefined) {
      return deleteCookie(event, name, opts)
    }

    // else ignore if cookie doesn't exist in browser and value is null/undefined
  }
}
