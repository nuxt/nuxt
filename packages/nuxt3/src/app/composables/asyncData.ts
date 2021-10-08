import { onBeforeMount, onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'
import { NuxtApp, useNuxtApp } from '#app'

export interface AsyncDataOptions<T> {
  server?: boolean
  defer?: boolean
  default?: () => T
}

export interface _AsyncData<T> {
  data: Ref<T>
  pending: Ref<boolean>
  refresh: (force?: boolean) => Promise<void>
  error?: any
}

export type AsyncData<T> = _AsyncData<T> & Promise<_AsyncData<T>>

const getDefault = () => null

export function useAsyncData<T extends Record<string, any>> (key: string, handler: (ctx?: NuxtApp) => Promise<T>, options: AsyncDataOptions<T> = {}): AsyncData<T> {
  // Validate arguments
  if (typeof key !== 'string') {
    throw new TypeError('asyncData key must be a string')
  }
  if (typeof handler !== 'function') {
    throw new TypeError('asyncData handler must be a function')
  }

  // Apply defaults
  options = { server: true, defer: false, default: getDefault, ...options }

  // Setup nuxt instance payload
  const nuxt = useNuxtApp()

  // Setup hook callbacks once per instance
  const instance = getCurrentInstance()
  if (!instance._nuxtOnBeforeMountCbs) {
    const cbs = instance._nuxtOnBeforeMountCbs = []
    if (instance && process.client) {
      onBeforeMount(() => {
        cbs.forEach((cb) => { cb() })
        cbs.splice(0, cbs.length)
      })
      onUnmounted(() => cbs.splice(0, cbs.length))
    }
  }

  const asyncData = {
    data: ref(nuxt.payload.data[key] ?? options.default()),
    pending: ref(true),
    error: ref(null)
  } as AsyncData<T>

  asyncData.refresh = (force?: boolean) => {
    // Avoid fetching same key more than once at a time
    if (nuxt._asyncDataPromises[key] && !force) {
      return nuxt._asyncDataPromises[key]
    }
    asyncData.pending.value = true
    // TODO: Cancel previus promise
    // TODO: Handle immediate errors
    nuxt._asyncDataPromises[key] = Promise.resolve(handler(nuxt))
      .then((result) => {
        asyncData.data.value = result
        asyncData.error.value = null
      })
      .catch((error: any) => {
        asyncData.error.value = error
        asyncData.data.value = options.default()
      })
      .finally(() => {
        asyncData.pending.value = false
        nuxt.payload.data[key] = asyncData.data.value
        delete nuxt._asyncDataPromises[key]
      })
    return nuxt._asyncDataPromises[key]
  }

  const fetchOnServer = options.server !== false
  const clientOnly = options.server === false

  // Server side
  if (process.server && fetchOnServer) {
    asyncData.refresh()
  }

  // Client side
  if (process.client) {
    // 1. Hydration (server: true): no fetch
    if (nuxt.isHydrating && fetchOnServer) {
      asyncData.pending.value = false
    }
    // 2. Initial load (server: false): fetch on mounted
    if (nuxt.isHydrating && clientOnly) {
      // Fetch on mounted (initial load or deferred fetch)
      instance._nuxtOnBeforeMountCbs.push(asyncData.refresh)
    } else if (!nuxt.isHydrating) { // Navigation
      if (options.defer) {
        // 3. Navigation (defer: true): fetch on mounted
        instance._nuxtOnBeforeMountCbs.push(asyncData.refresh)
      } else {
        // 4. Navigation (defer: false): await fetch
        asyncData.refresh()
      }
    }
  }

  // Allow directly awaiting on asyncData
  const asyncDataPromise = Promise.resolve(nuxt._asyncDataPromises[key]).then(() => asyncData) as AsyncData<T>
  Object.assign(asyncDataPromise, asyncData)

  return asyncDataPromise as AsyncData<T>
}
