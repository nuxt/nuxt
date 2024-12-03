import type { H3Event } from 'h3'
import { setResponseStatus as _setResponseStatus, appendHeader, getRequestHeader, getRequestHeaders, getResponseHeader, removeResponseHeader, setResponseHeader } from 'h3'
import { computed, getCurrentInstance, ref } from 'vue'
import { useServerHead } from '@unhead/vue'
import type { H3Event$Fetch } from 'nitropack'

import type { NuxtApp } from '../nuxt'
import { useNuxtApp } from '../nuxt'
import { toArray } from '../utils'

/** @since 3.0.0 */
export function useRequestEvent (nuxtApp: NuxtApp = useNuxtApp()) {
  return nuxtApp.ssrContext?.event
}

/** @since 3.0.0 */
export function useRequestHeaders<K extends string = string> (include: K[]): { [key in Lowercase<K>]?: string }
export function useRequestHeaders (): Readonly<Record<string, string>>
export function useRequestHeaders (include?: any[]) {
  if (import.meta.client) { return {} }
  const event = useRequestEvent()
  const _headers = event ? getRequestHeaders(event) : {}
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
export function useRequestHeader (header: string) {
  if (import.meta.client) { return undefined }
  const event = useRequestEvent()
  return event ? getRequestHeader(event, header) : undefined
}

/** @since 3.2.0 */
export function useRequestFetch (): H3Event$Fetch | typeof global.$fetch {
  if (import.meta.client) {
    return globalThis.$fetch
  }
  return useRequestEvent()?.$fetch || globalThis.$fetch
}

/** @since 3.0.0 */
export function setResponseStatus (event: H3Event, code?: number, message?: string): void
/** @deprecated Pass `event` as first option. */
export function setResponseStatus (code: number, message?: string): void
export function setResponseStatus (arg1: H3Event | number | undefined, arg2?: number | string, arg3?: string) {
  if (import.meta.client) { return }
  if (arg1 && typeof arg1 !== 'number') {
    return _setResponseStatus(arg1, arg2 as number | undefined, arg3)
  }
  const event = useRequestEvent()
  if (event) {
    return _setResponseStatus(event, arg1, arg2 as string | undefined)
  }
}

/** @since 3.14.0 */
export function useResponseHeader (header: string) {
  if (import.meta.client) {
    if (import.meta.dev) {
      return computed({
        get: () => undefined,
        set: () => console.warn('[nuxt] Setting response headers is not supported in the browser.'),
      })
    }
    return ref()
  }

  const event = useRequestEvent()!

  return computed({
    get () {
      return getResponseHeader(event, header)
    },
    set (newValue) {
      if (!newValue) {
        return removeResponseHeader(event, header)
      }

      return setResponseHeader(event, header, newValue)
    },
  })
}

/** @since 3.8.0 */
export function prerenderRoutes (path: string | string[]) {
  if (!import.meta.server || !import.meta.prerender) { return }

  const paths = toArray(path)
  appendHeader(useRequestEvent()!, 'x-nitro-prerender', paths.map(p => encodeURIComponent(p)).join(', '))
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
    throw new TypeError('[nuxt] To transform a callback into a string, `onPrehydrate` must be processed by the Nuxt build pipeline. If it is called in a third-party library, make sure to add the library to `build.transpile`.')
  }

  const vm = getCurrentInstance()
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

  useServerHead({
    script: [{
      key: vm && key ? key : code,
      tagPosition: 'bodyClose',
      tagPriority: 'critical',
      innerHTML: code,
    }],
  })

  return vm && key ? vm.attrs[PREHYDRATE_ATTR_KEY] as string : undefined
}
