import { onBeforeMount, onServerPrefetch, onUnmounted, ref, getCurrentInstance, watch, unref } from 'vue'
import type { Ref, WatchSource } from 'vue'
import { NuxtApp, useNuxtApp } from '#app'

export type _Transform<Input = any, Output = any> = (input: Input) => Output

export type PickFrom<T, K extends Array<string>> = T extends Array<any>
  ? T
  : T extends Record<string, any>
  ? keyof T extends K[number]
    ? T // Exact same keys as the target, skip Pick
    : Pick<T, K[number]>
  : T

export type KeysOf<T> = Array<keyof T extends string ? keyof T : string>
export type KeyOfRes<Transform extends _Transform> = KeysOf<ReturnType<Transform>>

type MultiWatchSources = (WatchSource<unknown> | object)[]

export interface AsyncDataOptions<
  DataT,
  Transform extends _Transform<DataT, any> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<_Transform> = KeyOfRes<Transform>
> {
  server?: boolean
  lazy?: boolean
  default?: () => DataT | Ref<DataT> | null
  transform?: Transform
  pick?: PickKeys
  watch?: MultiWatchSources
  initialCache?: boolean
  immediate?: boolean
}

export interface AsyncDataExecuteOptions {
  _initial?: boolean
}

export interface _AsyncData<DataT, ErrorT> {
  data: Ref<DataT | null>
  pending: Ref<boolean>
  refresh: (opts?: AsyncDataExecuteOptions) => Promise<void>
  execute: (opts?: AsyncDataExecuteOptions) => Promise<void>
  error: Ref<ErrorT | null>
}

export type AsyncData<Data, Error> = _AsyncData<Data, Error> & Promise<_AsyncData<Data, Error>>

const getDefault = () => null
export function useAsyncData<
  DataT,
  DataE = Error,
  Transform extends _Transform<DataT> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  handler: (ctx?: NuxtApp) => Promise<DataT>,
  options?: AsyncDataOptions<DataT, Transform, PickKeys>
): AsyncData<PickFrom<ReturnType<Transform>, PickKeys>, DataE | null | true>
export function useAsyncData<
  DataT,
  DataE = Error,
  Transform extends _Transform<DataT> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  key: string,
  handler: (ctx?: NuxtApp) => Promise<DataT>,
  options?: AsyncDataOptions<DataT, Transform, PickKeys>
): AsyncData<PickFrom<ReturnType<Transform>, PickKeys>, DataE | null | true>
export function useAsyncData<
  DataT,
  DataE = Error,
  Transform extends _Transform<DataT> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (...args: any[]): AsyncData<PickFrom<ReturnType<Transform>, PickKeys>, DataE | null | true> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') { args.unshift(autoKey) }

  // eslint-disable-next-line prefer-const
  let [key, handler, options = {}] = args as [string, (ctx?: NuxtApp) => Promise<DataT>, AsyncDataOptions<DataT, Transform, PickKeys>]

  // Validate arguments
  if (typeof key !== 'string') {
    throw new TypeError('[nuxt] [asyncData] key must be a string.')
  }
  if (typeof handler !== 'function') {
    throw new TypeError('[nuxt] [asyncData] handler must be a function.')
  }

  // Apply defaults
  options.server = options.server ?? true
  options.default = options.default ?? getDefault

  // TODO: remove support for `defer` in Nuxt 3 RC
  if ((options as any).defer) {
    console.warn('[useAsyncData] `defer` has been renamed to `lazy`. Support for `defer` will be removed in RC.')
  }
  options.lazy = options.lazy ?? (options as any).defer ?? false
  options.initialCache = options.initialCache ?? true
  options.immediate = options.immediate ?? true

  // Setup nuxt instance payload
  const nuxt = useNuxtApp()

  const useInitialCache = () => (nuxt.isHydrating || options.initialCache) && nuxt.payload.data[key] !== undefined

  // Create or use a shared asyncData entity
  if (!nuxt._asyncData[key]) {
    nuxt._asyncData[key] = {
      data: ref(useInitialCache() ? nuxt.payload.data[key] : options.default?.() ?? null),
      pending: ref(!useInitialCache()),
      error: ref(nuxt.payload._errors[key] ?? null)
    }
  }
  // TODO: Else, Soemhow check for confliciting keys with different defaults or fetcher
  const asyncData = { ...nuxt._asyncData[key] } as AsyncData<DataT, DataE>

  asyncData.refresh = asyncData.execute = (opts = {}) => {
    // Avoid fetching same key more than once at a time
    if (nuxt._asyncDataPromises[key]) {
      return nuxt._asyncDataPromises[key]
    }
    // Avoid fetching same key that is already fetched
    if (opts._initial && useInitialCache()) {
      return nuxt.payload.data[key]
    }
    asyncData.pending.value = true
    // TODO: Cancel previous promise
    nuxt._asyncDataPromises[key] = new Promise<DataT>(
      (resolve, reject) => {
        try {
          resolve(handler(nuxt))
        } catch (err) {
          reject(err)
        }
      })
      .then((result) => {
        if (options.transform) {
          result = options.transform(result)
        }
        if (options.pick) {
          result = pick(result as any, options.pick) as DataT
        }
        asyncData.data.value = result
        asyncData.error.value = null
      })
      .catch((error: any) => {
        asyncData.error.value = error
        asyncData.data.value = unref(options.default?.() ?? null)
      })
      .finally(() => {
        asyncData.pending.value = false
        nuxt.payload.data[key] = asyncData.data.value
        if (asyncData.error.value) {
          nuxt.payload._errors[key] = true
        }
        delete nuxt._asyncDataPromises[key]
      })
    return nuxt._asyncDataPromises[key]
  }

  const initialFetch = () => asyncData.refresh({ _initial: true })

  const fetchOnServer = options.server !== false && nuxt.payload.serverRendered

  // Server side
  if (process.server && fetchOnServer && options.immediate) {
    const promise = initialFetch()
    onServerPrefetch(() => promise)
  }

  // Client side
  if (process.client) {
    // Setup hook callbacks once per instance
    const instance = getCurrentInstance()
    if (instance && !instance._nuxtOnBeforeMountCbs) {
      instance._nuxtOnBeforeMountCbs = []
      const cbs = instance._nuxtOnBeforeMountCbs
      if (instance) {
        onBeforeMount(() => {
          cbs.forEach((cb) => { cb() })
          cbs.splice(0, cbs.length)
        })
        onUnmounted(() => cbs.splice(0, cbs.length))
      }
    }

    if (fetchOnServer && nuxt.isHydrating && key in nuxt.payload.data) {
      // 1. Hydration (server: true): no fetch
      asyncData.pending.value = false
    } else if (instance && ((nuxt.payload.serverRendered && nuxt.isHydrating) || options.lazy) && options.immediate) {
      // 2. Initial load (server: false): fetch on mounted
      // 3. Initial load or navigation (lazy: true): fetch on mounted
      instance._nuxtOnBeforeMountCbs.push(initialFetch)
    } else if (options.immediate) {
      // 4. Navigation (lazy: false) - or plugin usage: await fetch
      initialFetch()
    }
    if (options.watch) {
      watch(options.watch, () => asyncData.refresh())
    }
    const off = nuxt.hook('app:data:refresh', (keys) => {
      if (!keys || keys.includes(key)) {
        return asyncData.refresh()
      }
    })
    if (instance) {
      onUnmounted(off)
    }
  }

  // Allow directly awaiting on asyncData
  const asyncDataPromise = Promise.resolve(nuxt._asyncDataPromises[key]).then(() => asyncData) as AsyncData<DataT, DataE>
  Object.assign(asyncDataPromise, asyncData)

  return asyncDataPromise as AsyncData<PickFrom<ReturnType<Transform>, PickKeys>, DataE>
}
export function useLazyAsyncData<
  DataT,
  DataE = Error,
  Transform extends _Transform<DataT> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  handler: (ctx?: NuxtApp) => Promise<DataT>,
  options?: Omit<AsyncDataOptions<DataT, Transform, PickKeys>, 'lazy'>
): AsyncData<PickFrom<ReturnType<Transform>, PickKeys>, DataE | null | true>
export function useLazyAsyncData<
  DataT,
  DataE = Error,
  Transform extends _Transform<DataT> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  key: string,
  handler: (ctx?: NuxtApp) => Promise<DataT>,
  options?: Omit<AsyncDataOptions<DataT, Transform, PickKeys>, 'lazy'>
): AsyncData<PickFrom<ReturnType<Transform>, PickKeys>, DataE | null | true>
export function useLazyAsyncData<
  DataT,
  DataE = Error,
  Transform extends _Transform<DataT> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (...args: any[]): AsyncData<PickFrom<ReturnType<Transform>, PickKeys>, DataE | null | true> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') { args.unshift(autoKey) }
  const [key, handler, options] = args as [string, (ctx?: NuxtApp) => Promise<DataT>, AsyncDataOptions<DataT, Transform, PickKeys>]
  // @ts-ignore
  return useAsyncData(key, handler, { ...options, lazy: true }, null)
}

export function refreshNuxtData (keys?: string | string[]): Promise<void> {
  if (process.server) {
    return Promise.resolve()
  }
  const _keys = keys ? Array.isArray(keys) ? keys : [keys] : undefined
  return useNuxtApp().callHook('app:data:refresh', _keys)
}

function pick (obj: Record<string, any>, keys: string[]) {
  const newObj = {}
  for (const key of keys) {
    (newObj as any)[key] = obj[key]
  }
  return newObj
}
