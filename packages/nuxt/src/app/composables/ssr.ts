import { computed, getCurrentInstance, ref } from 'vue'
import type { TypedFetch } from '../types/fetch'
import type { RequestEvent } from '@nuxt/schema'
import type { $Fetch as OFetch } from 'ofetch'
import { $fetch } from '#build/fetch'

import type { NuxtApp } from '../nuxt'
import { useNuxtApp } from '../nuxt'
import { toArray } from '../utils'
import { appDiagnostics } from '../diagnostics/core'
import { useHead } from './head'

/** The request event, as declared by the configured `server.builder` (`H3Event` under `@nuxt/nitro-server`). */
export type { RequestEvent } from '@nuxt/schema'

/** @since 3.0.0 */
export function useRequestEvent (nuxtApp?: NuxtApp): RequestEvent | undefined {
  if (import.meta.client) { return }
  nuxtApp ||= useNuxtApp()
  return nuxtApp.ssrContext?.event
}

/**
 * @since 3.0.0
 * @deprecated Use useRequestEvent().req.headers
 */
export function useRequestHeaders<K extends string = string> (include: K[]): { [key in Lowercase<K>]?: string }
export function useRequestHeaders (): Readonly<Record<string, string>>
export function useRequestHeaders (include?: any[]): Readonly<Record<string, string>> {
  if (import.meta.client) { return {} }
  const event = useRequestEvent()
  const _headers = event ? Object.fromEntries(event.req.headers.entries()) : {}
  if (!include || !event) { return _headers }
  const headers = Object.create(null)
  for (const _key of include) {
    const key = _key.toLowerCase()
    const header = _headers[key]
    if (header) {
      headers[key] = header
    }
  }
  return headers
}

/** @since 3.9.0 */
export function useRequestHeader (header: string): string | null | undefined {
  if (import.meta.client) { return undefined }
  const event = useRequestEvent()
  return event ? event.req.headers.get(header) : undefined
}

// hop-by-hop headers, and headers describing a request body the subrequest does not have
const UNFORWARDED_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'connection',
  'content-length',
  'content-md5',
  'content-type',
  'expect',
  'host',
  'if-match',
  'if-modified-since',
  'if-none-match',
  'if-range',
  'if-unmodified-since',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

const requestFetchers = new WeakMap<RequestEvent, TypedFetch>()

function createRequestFetch (event: RequestEvent): TypedFetch {
  const base = $fetch as unknown as OFetch
  // the wrapper is installed as the underlying `fetch` rather than as an `onRequest` hook or
  // default headers, so that neither user-provided hooks nor absolute URLs can bypass the check
  return base.create({}, {
    fetch (request, options) {
      if (typeof request === 'string' && request[0] === '/') {
        const headers = new Headers(options?.headers)
        for (const [name, value] of event.req.headers) {
          if (!UNFORWARDED_HEADERS.has(name) && !headers.has(name)) {
            headers.set(name, value)
          }
        }
        options = { ...options, headers }
      }
      return base.native(request, options)
    },
  }) as unknown as TypedFetch
}

/** @since 3.2.0 */
export function useRequestFetch (): TypedFetch {
  if (import.meta.client) { return $fetch as TypedFetch }
  const event = useRequestEvent()
  if (!event) { return $fetch as TypedFetch }
  let fetcher = requestFetchers.get(event)
  if (!fetcher) {
    fetcher = createRequestFetch(event)
    requestFetchers.set(event, fetcher)
  }
  return fetcher
}

/** @since 3.0.0 */
export function setResponseStatus (event: RequestEvent, code?: number, message?: string): void
/** @deprecated Pass `event` as first option. */
export function setResponseStatus (code: number, message?: string): void
export function setResponseStatus (arg1: RequestEvent | number | undefined, arg2?: number | string, arg3?: string): void {
  if (import.meta.client) { return }
  if (arg1 && typeof arg1 !== 'number') {
    arg1.res.status = arg2 as number | undefined
    arg1.res.statusText = arg3
    return
  }
  const event = useRequestEvent()
  if (event) {
    event.res.status = arg1 as number
    event.res.statusText = arg2 as string | undefined
  }
}

/** @since 3.14.0 */
export function useResponseHeader (header: string): import('vue').WritableComputedRef<string | null | undefined> | import('vue').Ref<string | null | undefined> {
  if (import.meta.client) {
    if (import.meta.dev) {
      return computed({
        get: () => undefined,
        set: () => appDiagnostics.NUXT_E1010(),
      })
    }
    return ref()
  }

  const event = useRequestEvent()!

  return computed({
    get () {
      return event.res.headers.get(header)
    },
    set (newValue) {
      if (!newValue) {
        return event.res.headers.delete(header)
      }

      return event.res.headers.set(header, newValue)
    },
  })
}

/** @since 3.8.0 */
export function prerenderRoutes (path: string | string[]): void {
  if (!import.meta.server || !import.meta.prerender) { return }

  const paths = toArray(path)
  useRequestEvent()?.res.headers.append('x-nitro-prerender', paths.map(p => encodeURIComponent(p)).join(', '))
}

const PREHYDRATE_ATTR_KEY = 'data-prehydrate-id'

/**
 * `onPrehydrate` is a composable lifecycle hook that allows you to run a callback on the client immediately before
 * Nuxt hydrates the page. This is an advanced feature.
 *
 * The callback will be stringified and inlined in the HTML so it should not have any external
 * dependencies (such as auto-imports) or refer to variables defined outside the callback.
 *
 * The callback will run before Nuxt runtime initializes so it should not rely on the Nuxt or Vue context.
 * @since 3.12.0
 */
export function onPrehydrate (callback: (el: HTMLElement) => void): void
export function onPrehydrate (callback: string | ((el: HTMLElement) => void), key?: string): undefined | string {
  if (import.meta.client) { return }

  if (typeof callback !== 'string') {
    throw appDiagnostics.NUXT_E1006()
  }

  const vm = getCurrentInstance()
  if (import.meta.dev && !vm && key) {
    appDiagnostics.NUXT_E1013()
  }
  if (vm && key) {
    vm.attrs[PREHYDRATE_ATTR_KEY] ||= ''
    key = ':' + key + ':'
    if (!(vm.attrs[PREHYDRATE_ATTR_KEY] as string).includes(key)) {
      vm.attrs[PREHYDRATE_ATTR_KEY] += key
    }
  }
  const code = vm && key
    ? `document.querySelectorAll('[${PREHYDRATE_ATTR_KEY}*=${JSON.stringify(key)}]').forEach` + callback
    : (callback + '()')

  useHead({
    script: [{
      key: vm && key ? key : undefined,
      tagPosition: 'bodyClose',
      tagPriority: 'critical',
      innerHTML: code,
    }],
  })

  return vm && key ? vm.attrs[PREHYDRATE_ATTR_KEY] as string : undefined
}
