import type { ServerResponse } from 'http'
import { Ref, ref, watch } from 'vue'
import { parse, serialize, CookieParseOptions, CookieSerializeOptions } from 'cookie-es'
import { appendHeader } from 'h3'
import type { NuxtApp } from '@nuxt/schema'
import destr from 'destr'
import { useNuxtApp } from '#app'

type _CookieOptions = Omit<CookieSerializeOptions & CookieParseOptions, 'decode' | 'encode'>

export interface CookieOptions<T=any> extends _CookieOptions {
  decode?(value: string): T
  encode?(value: T): string;
  default?: () => T
}

export interface CookieRef<T> extends Ref<T> {}

const CookieDefaults: CookieOptions<any> = {
  decode: val => destr(decodeURIComponent(val)),
  encode: val => encodeURIComponent(typeof val === 'string' ? val : JSON.stringify(val))
}

export function useCookie <T=string> (name: string, _opts?: CookieOptions<T>): CookieRef<T> {
  const opts = { ...CookieDefaults, ..._opts }
  const cookies = readRawCookies(opts)

  const cookie = ref(cookies[name] ?? _opts.default?.())

  if (process.client) {
    watch(cookie, () => { writeClientCookie(name, cookie.value, opts as CookieSerializeOptions) })
  } else if (process.server) {
    const initialValue = cookie.value
    const nuxtApp = useNuxtApp()
    nuxtApp.hooks.hookOnce('app:rendered', () => {
      if (cookie.value !== initialValue) {
        // @ts-ignore
        writeServerCookie(useSSRRes(nuxtApp), name, cookie.value, opts)
      }
    })
  }

  return cookie as CookieRef<T>
}

// @ts-ignore
function useSSRReq (nuxtApp?: NuxtApp = useNuxtApp()) { return nuxtApp.ssrContext?.req }

// @ts-ignore
function useSSRRes (nuxtApp?: NuxtApp = useNuxtApp()) { return nuxtApp.ssrContext?.res }

function readRawCookies (opts: CookieOptions = {}): Record<string, string> {
  if (process.server) {
    return parse(useSSRReq().headers.cookie || '', opts)
  } else if (process.client) {
    return parse(document.cookie, opts)
  }
}

function serializeCookie (name: string, value: any, opts: CookieSerializeOptions = {}) {
  if (value === null || value === undefined) {
    opts.maxAge = -1
  }
  return serialize(name, value, opts)
}

function writeClientCookie (name: string, value: any, opts: CookieSerializeOptions = {}) {
  if (process.client) {
    document.cookie = serializeCookie(name, value, opts)
  }
}

function writeServerCookie (res: ServerResponse, name: string, value: any, opts: CookieSerializeOptions = {}) {
  if (res) {
    // TODO: Try to smart join with existing Set-Cookie headers
    appendHeader(res, 'Set-Cookie', serializeCookie(name, value, opts))
  }
}
