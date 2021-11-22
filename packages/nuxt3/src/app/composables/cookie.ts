import type { ServerResponse } from 'http'
import { Ref, ref, watch } from 'vue'
import type { CookieParseOptions, CookieSerializeOptions } from 'cookie'
import * as cookie from 'cookie'
import { appendHeader } from 'h3'
import type { NuxtApp } from '@nuxt/schema'
import destr from 'destr'
import { useNuxtApp } from '#app'

type _CookieOptions = Omit<CookieSerializeOptions & CookieParseOptions, 'decode' | 'encode'>
export interface CookieOptions<T=any> extends _CookieOptions {
  decode?(value: string): T
  encode?(value: T): string;
}

export interface CookieRef<T> extends Ref<T> {}

const CookieDefaults: CookieOptions<any> = {
  decode: val => destr(decodeURIComponent(val)),
  encode: val => encodeURIComponent(typeof val === 'string' ? val : JSON.stringify(val))
}

export function useCookie <T=string> (name: string, _opts: CookieOptions<T>): CookieRef<T> {
  const opts = { ...CookieDefaults, ..._opts }
  const cookies = readRawCookies(opts)

  const cookie = ref(opts.decode(cookies[name]))

  if (process.client) {
    watch(cookie, () => { writeClientCookie(name, cookie.value, opts) })
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

  return cookie
}

// @ts-ignore
function useSSRReq (nuxtApp?: NuxtApp = useNuxtApp()) { return nuxtApp.ssrContext?.req }

// @ts-ignore
function useSSRRes (nuxtApp?: NuxtApp = useNuxtApp()) { return nuxtApp.ssrContext?.res }

function readRawCookies (opts: CookieOptions = {}): Record<string, string> {
  if (process.server) {
    return cookie.parse(useSSRReq().headers.cookie || '', opts)
  } else if (process.client) {
    return cookie.parse(document.cookie, opts)
  }
}

function serializeCookie (name: string, value: any, opts: CookieSerializeOptions = {}) {
  if (value === null || value === undefined) {
    opts.maxAge = -1
  }
  return cookie.serialize(name, value, opts)
}

function writeClientCookie (name: string, value: any, opts: CookieSerializeOptions = {}) {
  if (process.client) {
    document.cookie = serializeCookie(name, value, opts)
  }
}

function writeServerCookie (res: ServerResponse, name: string, value: any, opts: CookieSerializeOptions = {}) {
  if (res) {
    // TODO: Try to smart join with exisiting Set-Cookie headers
    appendHeader(res, 'Set-Cookie', serializeCookie(name, value, opts))
  }
}
