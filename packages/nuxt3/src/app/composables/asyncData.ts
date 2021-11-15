import { onBeforeMount, onServerPrefetch, onUnmounted, ref, getCurrentInstance } from 'vue'
import type { Ref } from 'vue'
import { NuxtApp, useNuxtApp } from '#app'

export type _Transform<Input = any, Output = any> = (input: Input) => Output

export type PickFrom<T, K extends Array<string>> = T extends Array<any> ? T : T extends Record<string, any> ? Pick<T, K[number]> : T
export type KeysOf<T> = Array<keyof T extends string ? keyof T : string>
export type KeyOfRes<Transform extends _Transform> = KeysOf<ReturnType<Transform>>

export interface AsyncDataOptions<
  DataT,
  Transform extends _Transform<DataT, any> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<_Transform> = KeyOfRes<Transform>
  > {
  server?: boolean
  lazy?: boolean
  default?: () => DataT
  transform?: Transform
  pick?: PickKeys
}

export interface _AsyncData<DataT> {
  data: Ref<DataT>
  pending: Ref<boolean>
  refresh: (force?: boolean) => Promise<void>
  error?: any
}

export type AsyncData<Data> = _AsyncData<Data> & Promise<_AsyncData<Data>>

const getDefault = () => null

export function useAsyncData<
  DataT,
  Transform extends _Transform<DataT> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  key: string,
  handler: (ctx?: NuxtApp) => Promise<DataT>,
  options: AsyncDataOptions<DataT, Transform, PickKeys> = {}
): AsyncData<PickFrom<ReturnType<Transform>, PickKeys>> {
  // Validate arguments
  if (typeof key !== 'string') {
    throw new TypeError('asyncData key must be a string')
  }
  if (typeof handler !== 'function') {
    throw new TypeError('asyncData handler must be a function')
  }

  // Apply defaults
  options = { server: true, default: getDefault, ...options }
  // TODO: remove support for `defer` in Nuxt 3 RC
  if ((options as any).defer) {
    console.warn('[useAsyncData] `defer` has been renamed to `lazy`. Support for `defer` will be removed in RC.')
  }
  options.lazy = options.lazy ?? (options as any).defer ?? false

  // Setup nuxt instance payload
  const nuxt = useNuxtApp()

  // Setup hook callbacks once per instance
  const instance = getCurrentInstance()
  if (instance && !instance._nuxtOnBeforeMountCbs) {
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
  } as AsyncData<DataT>

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
        if (options.transform) {
          result = options.transform(result)
        }
        if (options.pick) {
          result = pick(result, options.pick) as DataT
        }
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

  const fetchOnServer = options.server !== false && nuxt.payload.serverRendered
  const clientOnly = options.server === false || !nuxt.payload.serverRendered

  // Server side
  if (process.server && fetchOnServer) {
    const promise = asyncData.refresh()
    onServerPrefetch(() => promise)
  }

  // Client side
  if (process.client) {
    // 1. Hydration (server: true): no fetch
    if (nuxt.isHydrating && fetchOnServer) {
      asyncData.pending.value = false
    }
    // 2. Initial load (server: false): fetch on mounted
    if (instance && nuxt.isHydrating && clientOnly) {
      // Fetch on mounted (initial load or lazy fetch)
      instance._nuxtOnBeforeMountCbs.push(asyncData.refresh)
    } else if (!nuxt.isHydrating) { // Navigation
      if (instance && options.lazy) {
        // 3. Navigation (lazy: true): fetch on mounted
        instance._nuxtOnBeforeMountCbs.push(asyncData.refresh)
      } else {
        // 4. Navigation (lazy: false) - or plugin usage: await fetch
        asyncData.refresh()
      }
    }
  }

  // Allow directly awaiting on asyncData
  const asyncDataPromise = Promise.resolve(nuxt._asyncDataPromises[key]).then(() => asyncData) as AsyncData<DataT>
  Object.assign(asyncDataPromise, asyncData)

  // @ts-ignore
  return asyncDataPromise as AsyncData<DataT>
}

export function useLazyAsyncData<
  DataT,
  Transform extends _Transform<DataT> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  key: string,
  handler: (ctx?: NuxtApp) => Promise<DataT>,
  options: Omit<AsyncDataOptions<DataT, Transform, PickKeys>, 'lazy'> = {}
): AsyncData<PickFrom<ReturnType<Transform>, PickKeys>> {
  return useAsyncData(key, handler, { ...options, lazy: true })
}

function pick (obj: Record<string, any>, keys: string[]) {
  const newObj = {}
  for (const key of keys) {
    newObj[key] = obj[key]
  }
  return newObj
}
