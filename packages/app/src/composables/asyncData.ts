import { Ref, ref, onMounted, watch, getCurrentInstance, onUnmounted } from 'vue'
import { Nuxt, useNuxt } from '@nuxt/app'

import { ensureReactive, useData } from './data'

export type AsyncDataFn<T> = (ctx?: Nuxt) => Promise<T>

export interface AsyncDataOptions {
  server?: boolean
  defer?: boolean
}

export interface AsyncDataObj<T> {
  data: Ref<T>
  pending: Ref<boolean>
  refresh: () => Promise<void>
  error?: any
}

export function useAsyncData (defaults?: AsyncDataOptions) {
  const nuxt = useNuxt()
  const vm = getCurrentInstance()

  const data = useData(nuxt, vm)
  let dataRef = 1

  const onMountedCbs: Array<() => void> = []

  if (process.client) {
    onMounted(() => {
      onMountedCbs.forEach((cb) => { cb() })
      onMountedCbs.splice(0, onMountedCbs.length)
    })

    onUnmounted(() => onMountedCbs.splice(0, onMountedCbs.length))
  }

  return async function asyncData<T = Record<string, any>> (
    handler: AsyncDataFn<T>,
    options?: AsyncDataOptions
  ): Promise<AsyncDataObj<T>> {
    if (typeof handler !== 'function') {
      throw new TypeError('asyncData handler must be a function')
    }
    options = {
      server: true,
      defer: false,
      ...defaults,
      ...options
    }

    const key = String(dataRef++)
    const pending = ref(true)

    const datastore = ensureReactive(data, key)

    const fetch = async () => {
      pending.value = true
      const _handler = handler(nuxt)

      if (_handler instanceof Promise) {
        // Let user resolve if request is promise
        // TODO: handle error
        const result = await _handler

        for (const _key in result) {
          datastore[_key] = result[_key]
        }

        pending.value = false
      } else {
        // Invalid request
        throw new TypeError('Invalid asyncData handler: ' + _handler)
      }
    }

    const clientOnly = options.server === false

    // Client side
    if (process.client) {
      // 1. Hydration (server: true): no fetch
      if (nuxt.isHydrating && options.server) {
        pending.value = false
      }
      // 2. Initial load (server: false): fetch on mounted
      if (nuxt.isHydrating && !options.server) {
        // Fetch on mounted (initial load or deferred fetch)
        onMountedCbs.push(fetch)
      } else if (!nuxt.isHydrating) {
        if (options.defer) {
          // 3. Navigation (defer: true): fetch on mounted
          onMountedCbs.push(fetch)
        } else {
          // 4. Navigation (defer: false): await fetch
          await fetch()
        }
      }
      // Watch handler
      watch(handler.bind(null, nuxt), fetch)
    }

    // Server side
    if (process.server && !clientOnly) {
      await fetch()
    }
    return {
      data: datastore,
      pending,
      refresh: fetch
    }
  }
}

export function asyncData<T = Record<string, any>> (
  handler: AsyncDataFn<T>,
  options?: AsyncDataOptions
): Promise<AsyncDataObj<T>> {
  return useAsyncData()(handler, options)
}
