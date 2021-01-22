import { Ref, toRef, onMounted, watch, getCurrentInstance, onUnmounted } from 'vue'
import { Nuxt, useNuxt } from 'nuxt/app'
import { $fetch } from 'ohmyfetch'
import { useData } from './data'

export type HTTPRequest = string | { method: string, url: string }
export type FetchRequest<T> = HTTPRequest | ((ctx: Nuxt) => HTTPRequest | Promise<T>)

export interface FetchOptions {
  server?: boolean
  defer?: boolean
  fetcher?: Function
  key?: string
}

export interface FetchObj<T> {
  data: Ref<T>
  fetch: Function
  error?: any
}

export function useFetch (defaults?: FetchOptions) {
  const nuxt = useNuxt()
  const vm = getCurrentInstance()

  let data = useData(nuxt, vm)
  let dataRef = 1

  const onMountedCbs = []

  if (process.client) {
    onMounted(() => {
      onMountedCbs.forEach((cb) => { cb() })
      onMountedCbs.splice(0, onMountedCbs.length)
    })

    onUnmounted(() => {
      onMountedCbs.splice(0, onMountedCbs.length)
      data = null
    })
  }

  return async function fetch<T = any> (request: FetchRequest<T>, options?: FetchOptions): Promise<FetchObj<T>> {
    options = {
      server: true,
      defer: false,
      fetcher: globalThis.$fetch || $fetch,
      ...defaults,
      ...options
    }

    const key = String(dataRef++)

    const fetch = async () => {
      const _request = typeof request === 'function'
        ? request(nuxt)
        : request

      if (_request instanceof Promise) {
        // Let user resolve if request is promise
        data[key] = await _request
      } else if (_request && (typeof _request === 'string' || _request.url)) {
        // Make HTTP request when request is string (url) or { url, ...opts }
        data[key] = await options.fetcher(_request)
      } else {
        // Invalid request
        throw new Error('Invalid fetch request: ' + _request)
      }
    }

    const clientOnly = options.server === false

    // Client side
    if (process.client) {
      // 1. Hydration (server: true): no fetch
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
      // Watch request
      if (typeof request === 'function') {
        watch(request, fetch)
      }
    }

    // Server side
    if (process.server && !clientOnly) {
      await fetch()
    }

    return {
      data: toRef<any, string>(data, key),
      fetch
    }
  }
}
