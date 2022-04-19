import { Ref, watch } from 'vue'
import { parse, serialize, CookieParseOptions, CookieSerializeOptions } from 'cookie-es'
import { appendHeader } from 'h3'
import type { CompatibilityEvent } from 'h3'
import destr from 'destr'
import { useRequestEvent } from './ssr'
import { wrapInRef } from './utils'
import { useNuxtApp } from '#app'

type _CookieOptions = Omit<CookieSerializeOptions & CookieParseOptions, 'decode' | 'encode'>

export interface CookieOptions<T=any> extends _CookieOptions {
  decode?(value: string): T
  encode?(value: T): string;
  default?: () => T | Ref<T>
}

export interface CookieRef<T> extends Ref<T> {}

const CookieDefaults: CookieOptions<any> = {
  path: '/',
  decode: val => destr(decodeURIComponent(val)),
  encode: val => encodeURIComponent(typeof val === 'string' ? val : JSON.stringify(val))
}

export function useCookie <T=string> (name: string, _opts?: CookieOptions<T>): CookieRef<T> {
  const opts = { ...CookieDefaults, ..._opts }
  const cookies = readRawCookies(opts)

  const cookie = wrapInRef<T>(cookies[name] ?? opts.default?.())

  if (process.client) {
    watch(cookie, () => { writeClientCookie(name, cookie.value, opts as CookieSerializeOptions) })
  } else if (process.server) {
    const nuxtApp = useNuxtApp()
    const writeFinalCookieValue = () => {
      if (cookie.value !== cookies[name]) {
        writeServerCookie(useRequestEvent(nuxtApp), name, cookie.value, opts)
      }
    }
    nuxtApp.hooks.hookOnce('app:rendered', writeFinalCookieValue)
    nuxtApp.hooks.hookOnce('app:redirected', writeFinalCookieValue)
  }

  return cookie as CookieRef<T>
}

function readRawCookies (opts: CookieOptions = {}): Record<string, string> {
  if (process.server) {
    return parse(useRequestEvent()?.req.headers.cookie || '', opts)
  } else if (process.client) {
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
  if (process.client) {
    document.cookie = serializeCookie(name, value, opts)
  }
}

function writeServerCookie (event: CompatibilityEvent, name: string, value: any, opts: CookieSerializeOptions = {}) {
  if (event) {
    // TODO: Try to smart join with existing Set-Cookie headers
    appendHeader(event, 'Set-Cookie', serializeCookie(name, value, opts))
  }
}
