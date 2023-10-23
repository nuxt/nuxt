import { getCurrentInstance, onBeforeMount, onServerPrefetch, onUnmounted, ref, shallowRef, toRef, unref, watch } from 'vue'
import type { Ref, WatchSource } from 'vue'
import type { NuxtApp } from '../nuxt'
import { useNuxtApp } from '../nuxt'
import { createError } from './error'
import { onNuxtReady } from './ready'

// @ts-expect-error virtual file
import { asyncDataDefaults } from '#build/nuxt.config.mjs'

export type AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error'

export type _Transform<Input = any, Output = any> = (input: Input) => Output

export type PickFrom<T, K extends Array<string>> = T extends Array<any>
  ? T
  : T extends Record<string, any>
    ? keyof T extends K[number]
      ? T // Exact same keys as the target, skip Pick
      : K[number] extends never
        ? T
        : Pick<T, K[number]>
    : T

export type KeysOf<T> = Array<
  T extends T // Include all keys of union types, not just common keys
  ? keyof T extends string
    ? keyof T
    : never
  : never
>

export type KeyOfRes<Transform extends _Transform> = KeysOf<ReturnType<Transform>>

export type MultiWatchSources = (WatchSource<unknown> | object)[]

export interface AsyncDataOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
> {
  server?: boolean
  lazy?: boolean
  default?: () => DefaultT | Ref<DefaultT>
  getCachedData?: (key: string) => DataT
  transform?: _Transform<ResT, DataT>
  pick?: PickKeys
  watch?: MultiWatchSources
  immediate?: boolean
  deep?: boolean
}

export interface AsyncDataExecuteOptions {
  _initial?: boolean
  /**
   * Force a refresh, even if there is already a pending request. Previous requests will
   * not be cancelled, but their result will not affect the data/pending state - and any
   * previously awaited promises will not resolve until this new request resolves.
   */
  dedupe?: boolean
}

export interface _AsyncData<DataT, ErrorT> {
  data: Ref<DataT>
  pending: Ref<boolean>
  refresh: (opts?: AsyncDataExecuteOptions) => Promise<DataT>
  execute: (opts?: AsyncDataExecuteOptions) => Promise<DataT>
  error: Ref<ErrorT | null>
  status: Ref<AsyncDataRequestStatus>
}

export type AsyncData<Data, Error> = _AsyncData<Data, Error> & Promise<_AsyncData<Data, Error>>

export function useAsyncData<
  ResT,
  DataE = Error,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
> (
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>
export function useAsyncData<
  ResT,
  DataE = Error,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DataT,
> (
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>
export function useAsyncData<
  ResT,
  DataE = Error,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
> (
  key: string,
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>
export function useAsyncData<
  ResT,
  DataE = Error,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DataT,
> (
  key: string,
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>
export function useAsyncData<
  ResT,
  DataE = Error,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
> (...args: any[]): AsyncData<PickFrom<DataT, PickKeys>, DataE | null> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') { args.unshift(autoKey) }

  // eslint-disable-next-line prefer-const
  let [key, handler, options = {}] = args as [string, (ctx?: NuxtApp) => Promise<ResT>, AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>]

  // Validate arguments
  if (typeof key !== 'string') {
    throw new TypeError('[nuxt] [asyncData] key must be a string.')
  }
  if (typeof handler !== 'function') {
    throw new TypeError('[nuxt] [asyncData] handler must be a function.')
  }

  // Setup nuxt instance payload
  const nuxt = useNuxtApp()

  // Used to get default values
  const getDefault = () => null
  const getDefaultCachedData = () => nuxt.isHydrating ? nuxt.payload.data[key] : nuxt.static.data[key]

  // Apply defaults
  options.server = options.server ?? true
  options.default = options.default ?? (getDefault as () => DefaultT)
  options.getCachedData = options.getCachedData ?? getDefaultCachedData

  options.lazy = options.lazy ?? false
  options.immediate = options.immediate ?? true
  options.deep = options.deep ?? asyncDataDefaults.deep

  const hasCachedData = () => ![null, undefined].includes(options.getCachedData!(key) as any)

  // Create or use a shared asyncData entity
  if (!nuxt._asyncData[key] || !options.immediate) {
    nuxt.payload._errors[key] ??= null

    const _ref = options.deep ? ref : shallowRef

    nuxt._asyncData[key] = {
      data: _ref(options.getCachedData!(key) ?? options.default!()),
      pending: ref(!hasCachedData()),
      error: toRef(nuxt.payload._errors, key),
      status: ref('idle')
    }
  }

  // TODO: Else, somehow check for conflicting keys with different defaults or fetcher
  const asyncData = { ...nuxt._asyncData[key] } as AsyncData<DataT | DefaultT, DataE>

  asyncData.refresh = asyncData.execute = (opts = {}) => {
    if (nuxt._asyncDataPromises[key]) {
      if (opts.dedupe === false) {
        // Avoid fetching same key more than once at a time
        return nuxt._asyncDataPromises[key]!
      }
      (nuxt._asyncDataPromises[key] as any).cancelled = true
    }
    // Avoid fetching same key that is already fetched
    if ((opts._initial || (nuxt.isHydrating && opts._initial !== false)) && hasCachedData()) {
      return Promise.resolve(options.getCachedData!(key))
    }
    asyncData.pending.value = true
    asyncData.status.value = 'pending'
    // TODO: Cancel previous promise
    const promise = new Promise<ResT>(
      (resolve, reject) => {
        try {
          resolve(handler(nuxt))
        } catch (err) {
          reject(err)
        }
      })
      .then((_result) => {
        // If this request is cancelled, resolve to the latest request.
        if ((promise as any).cancelled) { return nuxt._asyncDataPromises[key] }

        let result = _result as unknown as DataT
        if (options.transform) {
          result = options.transform(_result)
        }
        if (options.pick) {
          result = pick(result as any, options.pick) as DataT
        }
        asyncData.data.value = result
        asyncData.error.value = null
        asyncData.status.value = 'success'
      })
      .catch((error: any) => {
        // If this request is cancelled, resolve to the latest request.
        if ((promise as any).cancelled) { return nuxt._asyncDataPromises[key] }

        asyncData.error.value = error
        asyncData.data.value = unref(options.default!())
        asyncData.status.value = 'error'
      })
      .finally(() => {
        if ((promise as any).cancelled) { return }

        asyncData.pending.value = false
        nuxt.payload.data[key] = asyncData.data.value
        if (asyncData.error.value) {
          // We use `createError` and its .toJSON() property to normalize the error
          nuxt.payload._errors[key] = createError(asyncData.error.value)
        }
        delete nuxt._asyncDataPromises[key]
      })
    nuxt._asyncDataPromises[key] = promise
    return nuxt._asyncDataPromises[key]!
  }

  const initialFetch = () => asyncData.refresh({ _initial: true })

  const fetchOnServer = options.server !== false && nuxt.payload.serverRendered

  // Server side
  if (import.meta.server && fetchOnServer && options.immediate) {
    const promise = initialFetch()
    if (getCurrentInstance()) {
      onServerPrefetch(() => promise)
    } else {
      nuxt.hook('app:created', async () => { await promise })
    }
  }

  // Client side
  if (import.meta.client) {
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

    if (fetchOnServer && nuxt.isHydrating && (asyncData.error.value || hasCachedData())) {
      // 1. Hydration (server: true): no fetch
      asyncData.pending.value = false
      asyncData.status.value = asyncData.error.value ? 'error' : 'success'
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
    const off = nuxt.hook('app:data:refresh', async (keys) => {
      if (!keys || keys.includes(key)) {
        await asyncData.refresh()
      }
    })
    if (instance) {
      onUnmounted(off)
    }
  }

  // Allow directly awaiting on asyncData
  const asyncDataPromise = Promise.resolve(nuxt._asyncDataPromises[key]).then(() => asyncData) as AsyncData<ResT, DataE>
  Object.assign(asyncDataPromise, asyncData)

  return asyncDataPromise as AsyncData<PickFrom<DataT, PickKeys>, DataE>
}
export function useLazyAsyncData<
  ResT,
  DataE = Error,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
> (
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>
export function useLazyAsyncData<
  ResT,
  DataE = Error,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DataT,
> (
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>
export function useLazyAsyncData<
  ResT,
  DataE = Error,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
> (
  key: string,
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>
export function useLazyAsyncData<
  ResT,
  DataE = Error,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DataT,
> (
  key: string,
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>

export function useLazyAsyncData<
  ResT,
  DataE = Error,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
> (...args: any[]): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') { args.unshift(autoKey) }
  const [key, handler, options] = args as [string, (ctx?: NuxtApp) => Promise<ResT>, AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>]
  // @ts-expect-error we pass an extra argument to prevent a key being injected
  return useAsyncData(key, handler, { ...options, lazy: true }, null)
}

export function useNuxtData<DataT = any> (key: string): { data: Ref<DataT | null> } {
  const nuxt = useNuxtApp()

  // Initialize value when key is not already set
  if (!(key in nuxt.payload.data)) {
    nuxt.payload.data[key] = null
  }

  return {
    data: toRef(nuxt.payload.data, key)
  }
}

export async function refreshNuxtData (keys?: string | string[]): Promise<void> {
  if (import.meta.server) {
    return Promise.resolve()
  }

  await new Promise<void>(resolve => onNuxtReady(resolve))

  const _keys = keys ? Array.isArray(keys) ? keys : [keys] : undefined
  await useNuxtApp().hooks.callHookParallel('app:data:refresh', _keys)
}

export function clearNuxtData (keys?: string | string[] | ((key: string) => boolean)): void {
  const nuxtApp = useNuxtApp()
  const _allKeys = Object.keys(nuxtApp.payload.data)
  const _keys: string[] = !keys
    ? _allKeys
    : typeof keys === 'function'
      ? _allKeys.filter(keys)
      : Array.isArray(keys) ? keys : [keys]

  for (const key of _keys) {
    if (key in nuxtApp.payload.data) {
      nuxtApp.payload.data[key] = undefined
    }
    if (key in nuxtApp.payload._errors) {
      nuxtApp.payload._errors[key] = null
    }
    if (nuxtApp._asyncData[key]) {
      nuxtApp._asyncData[key]!.data.value = undefined
      nuxtApp._asyncData[key]!.error.value = null
      nuxtApp._asyncData[key]!.pending.value = false
      nuxtApp._asyncData[key]!.status.value = 'idle'
    }
    if (key in nuxtApp._asyncDataPromises) {
      nuxtApp._asyncDataPromises[key] = undefined
    }
  }
}

function pick (obj: Record<string, any>, keys: string[]) {
  const newObj = {}
  for (const key of keys) {
    (newObj as any)[key] = obj[key]
  }
  return newObj
}
