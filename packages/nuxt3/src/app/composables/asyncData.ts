import { getCurrentInstance, onBeforeMount, onUnmounted, ref, unref } from 'vue'
import type { UnwrapRef, Ref } from 'vue'

import { NuxtComponentPendingPromises } from './component'
import { ensureReactive, useGlobalData } from './data'
import { Nuxt, useNuxt } from '#app'

export type AsyncDataFn<T> = (ctx?: Nuxt) => Promise<T>

export interface AsyncDataOptions {
  server?: boolean
  defer?: boolean
}

export interface AsyncDataState<T> {
  data: UnwrapRef<T>
  pending: Ref<boolean>
  fetch: (force?: boolean) => Promise<UnwrapRef<T>>
  error?: any
}

export type AsyncDataResult<T> = AsyncDataState<T> & Promise<AsyncDataState<T>>

export function useAsyncData (defaults?: AsyncDataOptions) {
  const nuxt = useNuxt()
  const vm = getCurrentInstance()
  const onBeforeMountCbs: Array<() => void> = []

  if (process.client) {
    onBeforeMount(() => {
      onBeforeMountCbs.forEach((cb) => { cb() })
      onBeforeMountCbs.splice(0, onBeforeMountCbs.length)
    })

    onUnmounted(() => onBeforeMountCbs.splice(0, onBeforeMountCbs.length))
  }

  nuxt._asyncDataPromises = nuxt._asyncDataPromises || {}

  return function asyncData<T extends Record<string, any>> (
    key: string,
    handler: AsyncDataFn<T>,
    options: AsyncDataOptions = {}
  ): AsyncDataResult<T> {
    if (typeof handler !== 'function') {
      throw new TypeError('asyncData handler must be a function')
    }
    options = {
      server: true,
      defer: false,
      ...defaults,
      ...options
    }

    const globalData = useGlobalData(nuxt)

    const state = {
      data: ensureReactive(globalData, key) as UnwrapRef<T>,
      pending: ref(true)
    } as AsyncDataState<T>

    const fetch = (force?: boolean): Promise<UnwrapRef<T>> => {
      if (nuxt._asyncDataPromises[key] && !force) {
        return nuxt._asyncDataPromises[key]
      }
      state.pending.value = true
      nuxt._asyncDataPromises[key] = Promise.resolve(handler(nuxt)).then((result) => {
        for (const _key in result) {
          state.data[_key] = unref(result[_key])
        }
        return state.data
      }).finally(() => {
        state.pending.value = false
        nuxt._asyncDataPromises[key] = null
      })
      return nuxt._asyncDataPromises[key]
    }

    const fetchOnServer = options.server !== false
    const clientOnly = options.server === false

    // Server side
    if (process.server && fetchOnServer) {
      fetch()
    }

    // Client side
    if (process.client) {
      // 1. Hydration (server: true): no fetch
      if (nuxt.isHydrating && fetchOnServer) {
        state.pending.value = false
      }
      // 2. Initial load (server: false): fetch on mounted
      if (nuxt.isHydrating && clientOnly) {
        // Fetch on mounted (initial load or deferred fetch)
        onBeforeMountCbs.push(fetch)
      } else if (!nuxt.isHydrating) { // Navigation
        if (options.defer) {
          // 3. Navigation (defer: true): fetch on mounted
          onBeforeMountCbs.push(fetch)
        } else {
          // 4. Navigation (defer: false): await fetch
          fetch()
        }
      }
    }

    // Auto enqueue if within nuxt component instance
    if (nuxt._asyncDataPromises[key] && vm[NuxtComponentPendingPromises]) {
      vm[NuxtComponentPendingPromises].push(nuxt._asyncDataPromises[key])
    }

    const res = Promise.resolve(nuxt._asyncDataPromises[key]).then(() => state) as AsyncDataResult<T>
    res.data = state.data
    res.pending = state.pending
    res.fetch = fetch
    return res
  }
}

export function asyncData<T extends Record<string, any>> (
  key: string, handler: AsyncDataFn<T>, options?: AsyncDataOptions
): AsyncDataResult<T> {
  return useAsyncData()(key, handler, options)
}
