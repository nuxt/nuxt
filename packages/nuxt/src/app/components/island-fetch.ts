import type { ComputedRef, Ref } from 'vue'
import { computed, getCurrentInstance, onBeforeUnmount, ref, toRaw, watch } from 'vue'
import { debounce } from 'perfect-debounce'
import type { ActiveHeadEntry, SerializableHead } from '@unhead/vue'
import { joinURL } from 'ufo'

import type { NuxtIslandResponse } from '../types'
import { useNuxtApp } from '../nuxt'
import { createError } from '../composables/error'
import { prerenderRoutes, useRequestFetch } from '../composables/ssr'
import { injectHead } from '../composables/head'
import { getIslandHash, serializeIslandProps } from '../island-hash'
import { renderDiagnostics } from '../diagnostics/render'

import { remoteComponentIslands } from '#build/nuxt.config.mjs'
import { $fetch } from '#build/fetch'

export interface IslandFetchProps {
  name: string
  lazy?: boolean
  props?: Record<string, any>
  context?: Record<string, any>
  source?: string
}

export interface IslandPayload {
  revive: Partial<NuxtIslandResponse>
  data: Partial<NuxtIslandResponse>
}

export interface IslandFetchOptions {
  props: IslandFetchProps
  uid: Ref<string>
  emit: (event: 'error', error: unknown) => void
  toPayload: (result: NuxtIslandResponse) => IslandPayload
  apply: (result: NuxtIslandResponse) => void | Promise<void>
}

export interface IslandFetch {
  error: Ref<unknown>
  serializedProps: ComputedRef<string>
  hashId: ComputedRef<string>
  islandKey: ComputedRef<string>
  fetchComponent: (force?: boolean) => Promise<void>
  guard: (fn: () => unknown) => Promise<void>
  load: (hydrate?: () => unknown) => Promise<void>
}

const PROMISES_KEY = '_islandPromises'

export function useIslandFetch (options: IslandFetchOptions): IslandFetch {
  const { props, uid, emit } = options
  const nuxtApp = useNuxtApp()
  const instance = getCurrentInstance()!
  const head = injectHead()
  const islandFetch = import.meta.server ? useRequestFetch() : $fetch
  const error = ref<unknown>(null)
  const serializedProps = computed(() => serializeIslandProps(props.props))
  const hashId = computed(() => getIslandHash({ name: props.name, props: serializedProps.value, context: props.context, source: props.source }))
  const islandKey = computed(() => `${props.name}_${hashId.value}`)

  let activeHead: ActiveHeadEntry<SerializableHead> | undefined
  onBeforeUnmount(() => { activeHead?.dispose() })

  function setPayload (key: string, result: NuxtIslandResponse) {
    const { revive, data } = options.toPayload(result)
    nuxtApp.payload.data[key] = {
      __nuxt_island: {
        key,
        ...(import.meta.server && import.meta.prerender)
          ? {}
          : { params: { ...props.context, props: props.props ? serializedProps.value : undefined } },
        result: revive,
      },
      ...data,
    }
  }

  async function _fetchComponent (force: boolean): Promise<NuxtIslandResponse> {
    const key = islandKey.value

    if (!force) {
      const cached = await nuxtApp.payload.data[key]
      if (cached?.html) { return cached }
    }

    const url = remoteComponentIslands && props.source ? joinURL(props.source, `/__nuxt_island/${key}.json`) : `/__nuxt_island/${key}.json`
    if (import.meta.server && import.meta.prerender) {
      nuxtApp.runWithContext(() => prerenderRoutes(url))
    }
    // $fetch handles `app.baseURL` for relative URLs
    const r = await islandFetch.raw<NuxtIslandResponse>(url, {
      // custom island sources should not be resolved against `app.baseURL` (#23093)
      ...(props.source ? { baseURL: '' } : {}),
      query: {
        ...props.context,
        props: props.props ? serializedProps.value : undefined,
      },
      responseType: 'json',
      ignoreResponseError: true,
    })
    // the island render is a separate request, so its hints only reach the page that
    // embedded it over the wire, including when the render failed part-way
    if (import.meta.server && import.meta.prerender) {
      const hints = r.headers.get('x-nuxt-prerender')
      if (hints) {
        nuxtApp.runWithContext(() => prerenderRoutes(hints.split(',').map(hint => decodeURIComponent(hint.trim()))))
      }
    }
    if (!r.ok) {
      throw createError({ status: r.status, statusText: r.statusText })
    }
    try {
      const result = r._data!
      setPayload(key, result)
      return result
    } catch (e: any) {
      if (r.status !== 200) {
        throw renderDiagnostics.NUXT_E4012({ name: props.name, status: r.status, detail: e.message, cause: e })
      }
      throw e
    }
  }

  async function guard (fn: () => unknown): Promise<void> {
    try {
      await fn()
    } catch (e) {
      error.value = e
      emit('error', e)
    }
  }

  function fetchComponent (force = false): Promise<void> {
    const promises = nuxtApp[PROMISES_KEY] ||= {}
    const id = uid.value
    const pending: Promise<NuxtIslandResponse> = promises[id] ||= _fetchComponent(force).finally(() => {
      delete promises[id]
    })
    return guard(async () => {
      const res = await pending
      error.value = null
      await options.apply(res)
      if (res.head) {
        if (activeHead) {
          activeHead.patch(res.head)
        } else {
          activeHead = head.push(res.head)
        }
      }
    })
  }

  if (import.meta.hot) {
    import.meta.hot.on(`nuxt-server-component:${props.name}`, () => {
      fetchComponent(true)
    })
  }

  if (import.meta.client) {
    watch(props, debounce(() => fetchComponent(), 100), { deep: true })
  }

  // Restore head entries from SSR payload during hydration
  if (import.meta.client && instance.vnode.el) {
    const headData = toRaw(nuxtApp.payload.data[islandKey.value])?.head
    if (headData) {
      activeHead = head.push(headData)
    }
  }

  async function load (hydrate?: () => unknown): Promise<void> {
    if (import.meta.client && !instance.vnode.el && props.lazy) {
      fetchComponent()
    } else if (import.meta.server || !instance.vnode.el || !nuxtApp.payload.serverRendered) {
      await fetchComponent()
    } else if (hydrate) {
      await hydrate()
    }
  }

  return { error, serializedProps, hashId, islandKey, fetchComponent, guard, load }
}
