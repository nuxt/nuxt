import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import type { CookieParseOptions, CookieSerializeOptions } from 'cookie-es'
import { parse, serialize } from 'cookie-es'
import { appendHeader } from 'h3'
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

const CookieDefaults: CookieOptions<any> = {
  path: '/',
  watch: true,
  decode: val => destr(decodeURIComponent(val)),
  encode: val => encodeURIComponent(typeof val === 'string' ? val : JSON.stringify(val))
}

export function useCookie <T = string | null | undefined> (name: string, _opts?: CookieOptions<T>): CookieRef<T> {
  const opts = { ...CookieDefaults, ..._opts }
  const cookies = readRawCookies(opts) || {}

  const cookie = ref<T | undefined>(cookies[name] as any ?? opts.default?.())

  if (process.client) {
    const callback = () => { writeClientCookie(name, cookie.value, opts as CookieSerializeOptions) }
    if (opts.watch) {
      watch(cookie, callback, { deep: opts.watch !== 'shallow' })
    } else {
      callback()
    }
  } else if (process.server) {
    const nuxtApp = useNuxtApp()
    const writeFinalCookieValue = () => {
      if (!isEqual(cookie.value, cookies[name])) {
        writeServerCookie(useRequestEvent(nuxtApp), name, cookie.value, opts)
      }
    }
    const unhook = nuxtApp.hooks.hookOnce('app:rendered', writeFinalCookieValue)
    nuxtApp.hooks.hookOnce('app:redirected', () => {
      // don't write cookie subsequently when app:rendered is called
      unhook()
      return writeFinalCookieValue()
    })
  }

  return cookie as CookieRef<T>
}

function readRawCookies (opts: CookieOptions = {}): Record<string, string> | undefined {
  if (process.server) {
    return parse(useRequestEvent()?.node.req.headers.cookie || '', opts)
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

function writeServerCookie (event: H3Event, name: string, value: any, opts: CookieSerializeOptions = {}) {
  if (event) {
    // TODO: Try to smart join with existing Set-Cookie headers
    appendHeader(event, 'Set-Cookie', serializeCookie(name, value, opts))
  }
}
