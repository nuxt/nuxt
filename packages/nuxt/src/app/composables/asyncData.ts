import { computed, getCurrentInstance, getCurrentScope, onBeforeMount, onScopeDispose, onServerPrefetch, onUnmounted, ref, shallowRef, toRef, unref, watch } from 'vue'
import type { Ref, WatchSource } from 'vue'
import type { NuxtApp } from '../nuxt'
import { useNuxtApp } from '../nuxt'
import { toArray } from '../utils'
import type { NuxtError } from './error'
import { createError } from './error'
import { onNuxtReady } from './ready'

// @ts-expect-error virtual file
import { asyncDataDefaults } from '#build/nuxt.config.mjs'

export type AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error'

export type _Transform<Input = any, Output = any> = (input: Input) => Output | Promise<Output>

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

export type NoInfer<T> = [T][T extends any ? 0 : never]

export interface AsyncDataOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
> {
  /**
   * Whether to fetch on the server side.
   * @default true
   */
  server?: boolean
  /**
   * Whether to resolve the async function after loading the route, instead of blocking client-side navigation
   * @default false
   */
  lazy?: boolean
  /**
   * a factory function to set the default value of the data, before the async function resolves - useful with the `lazy: true` or `immediate: false` options
   */
  default?: () => DefaultT | Ref<DefaultT>
  /**
   * Provide a function which returns cached data.
   * A `null` or `undefined` return value will trigger a fetch.
   * Default is `key => nuxt.isHydrating ? nuxt.payload.data[key] : nuxt.static.data[key]` which only caches data when payloadExtraction is enabled.
   */
  getCachedData?: (key: string, nuxtApp: NuxtApp) => NoInfer<DataT>
  /**
   * A function that can be used to alter handler function result after resolving.
   * Do not use it along with the `pick` option.
   */
  transform?: _Transform<ResT, DataT>
  /**
   * Only pick specified keys in this array from the handler function result.
   * Do not use it along with the `transform` option.
   */
  pick?: PickKeys
  /**
   * Watch reactive sources to auto-refresh when changed
   */
  watch?: MultiWatchSources
  /**
   * When set to false, will prevent the request from firing immediately
   * @default true
   */
  immediate?: boolean
  /**
   * Return data in a deep ref object (it is true by default). It can be set to false to return data in a shallow ref object, which can improve performance if your data does not need to be deeply reactive.
   */
  deep?: boolean
  /**
   * Avoid fetching the same key more than once at a time
   * @default 'cancel'
   */
  dedupe?: 'cancel' | 'defer'
}

export interface AsyncDataExecuteOptions {
  _initial?: boolean
  // TODO: remove boolean option in Nuxt 4
  /**
   * Force a refresh, even if there is already a pending request. Previous requests will
   * not be cancelled, but their result will not affect the data/pending state - and any
   * previously awaited promises will not resolve until this new request resolves.
   *
   * Instead of using `boolean` values, use `cancel` for `true` and `defer` for `false`.
   * Boolean values will be removed in a future release.
   */
  dedupe?: boolean | 'cancel' | 'defer'
}

export interface _AsyncData<DataT, ErrorT> {
  data: Ref<DataT>
  pending: Ref<boolean>
  refresh: (opts?: AsyncDataExecuteOptions) => Promise<void>
  execute: (opts?: AsyncDataExecuteOptions) => Promise<void>
  clear: () => void
  error: Ref<ErrorT | null>
  status: Ref<AsyncDataRequestStatus>
}

export type AsyncData<Data, Error> = _AsyncData<Data, Error> & Promise<_AsyncData<Data, Error>>

// TODO: remove boolean option in Nuxt 4
const isDefer = (dedupe?: boolean | 'cancel' | 'defer') => dedupe === 'defer' || dedupe === false

/**
 * Provides access to data that resolves asynchronously in an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-async-data}
 * @since 3.0.0
 * @param handler An asynchronous function that must return a truthy value (for example, it should not be `undefined` or `null`) or the request may be duplicated on the client side.
 * @param options customize the behavior of useAsyncData
 */
export function useAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
> (
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | null>
/**
 * Provides access to data that resolves asynchronously in an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-async-data}
 * @param handler An asynchronous function that must return a truthy value (for example, it should not be `undefined` or `null`) or the request may be duplicated on the client side.
 * @param options customize the behavior of useAsyncData
 */
export function useAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DataT,
> (
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | null>
/**
 * Provides access to data that resolves asynchronously in an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-async-data}
 * @param key A unique key to ensure that data fetching can be properly de-duplicated across requests.
 * @param handler An asynchronous function that must return a truthy value (for example, it should not be `undefined` or `null`) or the request may be duplicated on the client side.
 * @param options customize the behavior of useAsyncData
 */
export function useAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
> (
  key: string,
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | null>
/**
 * Provides access to data that resolves asynchronously in an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-async-data}
 * @param key A unique key to ensure that data fetching can be properly de-duplicated across requests.
 * @param handler An asynchronous function that must return a truthy value (for example, it should not be `undefined` or `null`) or the request may be duplicated on the client side.
 * @param options customize the behavior of useAsyncData
 */
export function useAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DataT,
> (
  key: string,
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | null>
export function useAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
> (...args: any[]): AsyncData<PickFrom<DataT, PickKeys>, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | null> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') { args.unshift(autoKey) }

  // eslint-disable-next-line prefer-const
  let [key, _handler, options = {}] = args as [string, (ctx?: NuxtApp) => Promise<ResT>, AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>]

  // Validate arguments
  if (typeof key !== 'string') {
    throw new TypeError('[nuxt] [asyncData] key must be a string.')
  }
  if (typeof _handler !== 'function') {
    throw new TypeError('[nuxt] [asyncData] handler must be a function.')
  }

  // Setup nuxt instance payload
  const nuxtApp = useNuxtApp()

  // When prerendering, share payload data automatically between requests
  const handler = import.meta.client || !import.meta.prerender || !nuxtApp.ssrContext?._sharedPrerenderCache
    ? _handler
    : () => {
        const value = nuxtApp.ssrContext!._sharedPrerenderCache!.get(key)
        if (value) { return value as Promise<ResT> }

        const promise = nuxtApp.runWithContext(_handler)

        nuxtApp.ssrContext!._sharedPrerenderCache!.set(key, promise)
        return promise
      }

  // Used to get default values
  const getDefault = () => null
  const getDefaultCachedData = () => nuxtApp.isHydrating ? nuxtApp.payload.data[key] : nuxtApp.static.data[key]

  // Apply defaults
  options.server = options.server ?? true
  options.default = options.default ?? (getDefault as () => DefaultT)
  options.getCachedData = options.getCachedData ?? getDefaultCachedData

  options.lazy = options.lazy ?? false
  options.immediate = options.immediate ?? true
  options.deep = options.deep ?? asyncDataDefaults.deep
  options.dedupe = options.dedupe ?? 'cancel'

  if (import.meta.dev && typeof options.dedupe === 'boolean') {
    console.warn('[nuxt] `boolean` values are deprecated for the `dedupe` option of `useAsyncData` and will be removed in the future. Use \'cancel\' or \'defer\' instead.')
  }

  const hasCachedData = () => options.getCachedData!(key, nuxtApp) != null

  // Create or use a shared asyncData entity
  if (!nuxtApp._asyncData[key] || !options.immediate) {
    nuxtApp.payload._errors[key] ??= null

    const _ref = options.deep ? ref : shallowRef

    nuxtApp._asyncData[key] = {
      data: _ref(options.getCachedData!(key, nuxtApp) ?? options.default!()),
      pending: ref(!hasCachedData()),
      error: toRef(nuxtApp.payload._errors, key),
      status: ref('idle'),
    }
  }

  // TODO: Else, somehow check for conflicting keys with different defaults or fetcher
  const asyncData = { ...nuxtApp._asyncData[key] } as AsyncData<DataT | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)>

  asyncData.refresh = asyncData.execute = (opts = {}) => {
    if (nuxtApp._asyncDataPromises[key]) {
      if (isDefer(opts.dedupe ?? options.dedupe)) {
        // Avoid fetching same key more than once at a time
        return nuxtApp._asyncDataPromises[key]!
      }
      (nuxtApp._asyncDataPromises[key] as any).cancelled = true
    }
    // Avoid fetching same key that is already fetched
    if ((opts._initial || (nuxtApp.isHydrating && opts._initial !== false)) && hasCachedData()) {
      return Promise.resolve(options.getCachedData!(key, nuxtApp))
    }
    asyncData.pending.value = true
    asyncData.status.value = 'pending'
    // TODO: Cancel previous promise
    const promise = new Promise<ResT>(
      (resolve, reject) => {
        try {
          resolve(handler(nuxtApp))
        } catch (err) {
          reject(err)
        }
      })
      .then(async (_result) => {
        // If this request is cancelled, resolve to the latest request.
        if ((promise as any).cancelled) { return nuxtApp._asyncDataPromises[key] }

        let result = _result as unknown as DataT
        if (options.transform) {
          result = await options.transform(_result)
        }
        if (options.pick) {
          result = pick(result as any, options.pick) as DataT
        }

        nuxtApp.payload.data[key] = result

        asyncData.data.value = result
        asyncData.error.value = null
        asyncData.status.value = 'success'
      })
      .catch((error: any) => {
        // If this request is cancelled, resolve to the latest request.
        if ((promise as any).cancelled) { return nuxtApp._asyncDataPromises[key] }

        asyncData.error.value = createError<NuxtErrorDataT>(error) as (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)
        asyncData.data.value = unref(options.default!())
        asyncData.status.value = 'error'
      })
      .finally(() => {
        if ((promise as any).cancelled) { return }

        asyncData.pending.value = false

        delete nuxtApp._asyncDataPromises[key]
      })
    nuxtApp._asyncDataPromises[key] = promise
    return nuxtApp._asyncDataPromises[key]!
  }

  asyncData.clear = () => clearNuxtDataByKey(nuxtApp, key)

  const initialFetch = () => asyncData.refresh({ _initial: true })

  const fetchOnServer = options.server !== false && nuxtApp.payload.serverRendered

  // Server side
  if (import.meta.server && fetchOnServer && options.immediate) {
    const promise = initialFetch()
    if (getCurrentInstance()) {
      onServerPrefetch(() => promise)
    } else {
      nuxtApp.hook('app:created', async () => { await promise })
    }
  }

  // Client side
  if (import.meta.client) {
    // Setup hook callbacks once per instance
    const instance = getCurrentInstance()
    if (import.meta.dev && !nuxtApp.isHydrating && (!instance || instance?.isMounted)) {
      // @ts-expect-error private property
      console.warn(`[nuxt] [${options._functionName || 'useAsyncData'}] Component is already mounted, please use $fetch instead. See https://nuxt.com/docs/getting-started/data-fetching`)
    }
    if (instance && !instance._nuxtOnBeforeMountCbs) {
      instance._nuxtOnBeforeMountCbs = []
      const cbs = instance._nuxtOnBeforeMountCbs
      onBeforeMount(() => {
        cbs.forEach((cb) => { cb() })
        cbs.splice(0, cbs.length)
      })
      onUnmounted(() => cbs.splice(0, cbs.length))
    }

    if (fetchOnServer && nuxtApp.isHydrating && (asyncData.error.value || hasCachedData())) {
      // 1. Hydration (server: true): no fetch
      asyncData.pending.value = false
      asyncData.status.value = asyncData.error.value ? 'error' : 'success'
    } else if (instance && ((nuxtApp.payload.serverRendered && nuxtApp.isHydrating) || options.lazy) && options.immediate) {
      // 2. Initial load (server: false): fetch on mounted
      // 3. Initial load or navigation (lazy: true): fetch on mounted
      instance._nuxtOnBeforeMountCbs.push(initialFetch)
    } else if (options.immediate) {
      // 4. Navigation (lazy: false) - or plugin usage: await fetch
      initialFetch()
    }
    const hasScope = getCurrentScope()
    if (options.watch) {
      const unsub = watch(options.watch, () => asyncData.refresh())
      if (hasScope) {
        onScopeDispose(unsub)
      }
    }
    const off = nuxtApp.hook('app:data:refresh', async (keys) => {
      if (!keys || keys.includes(key)) {
        await asyncData.refresh()
      }
    })
    if (hasScope) {
      onScopeDispose(off)
    }
  }

  // Allow directly awaiting on asyncData
  const asyncDataPromise = Promise.resolve(nuxtApp._asyncDataPromises[key]).then(() => asyncData) as AsyncData<ResT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)>
  Object.assign(asyncDataPromise, asyncData)

  return asyncDataPromise as AsyncData<PickFrom<DataT, PickKeys>, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)>
}
/** @since 3.0.0 */
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
  const [key, handler, options = {}] = args as [string, (ctx?: NuxtApp) => Promise<ResT>, AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>]

  if (import.meta.dev && import.meta.client) {
    // @ts-expect-error private property
    options._functionName ||= 'useLazyAsyncData'
  }

  // @ts-expect-error we pass an extra argument to prevent a key being injected
  return useAsyncData(key, handler, { ...options, lazy: true }, null)
}

/** @since 3.1.0 */
export function useNuxtData<DataT = any> (key: string): { data: Ref<DataT | null> } {
  const nuxtApp = useNuxtApp()

  // Initialize value when key is not already set
  if (!(key in nuxtApp.payload.data)) {
    nuxtApp.payload.data[key] = null
  }

  return {
    data: computed({
      get () {
        return nuxtApp._asyncData[key]?.data.value ?? nuxtApp.payload.data[key]
      },
      set (value) {
        if (nuxtApp._asyncData[key]) {
          nuxtApp._asyncData[key]!.data.value = value
        } else {
          nuxtApp.payload.data[key] = value
        }
      },
    }),
  }
}

/** @since 3.0.0 */
export async function refreshNuxtData (keys?: string | string[]): Promise<void> {
  if (import.meta.server) {
    return Promise.resolve()
  }

  await new Promise<void>(resolve => onNuxtReady(resolve))

  const _keys = keys ? toArray(keys) : undefined
  await useNuxtApp().hooks.callHookParallel('app:data:refresh', _keys)
}

/** @since 3.0.0 */
export function clearNuxtData (keys?: string | string[] | ((key: string) => boolean)): void {
  const nuxtApp = useNuxtApp()
  const _allKeys = Object.keys(nuxtApp.payload.data)
  const _keys: string[] = !keys
    ? _allKeys
    : typeof keys === 'function'
      ? _allKeys.filter(keys)
      : toArray(keys)

  for (const key of _keys) {
    clearNuxtDataByKey(nuxtApp, key)
  }
}

function clearNuxtDataByKey (nuxtApp: NuxtApp, key: string): void {
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
    (nuxtApp._asyncDataPromises[key] as any).cancelled = true
    nuxtApp._asyncDataPromises[key] = undefined
  }
}

function pick (obj: Record<string, any>, keys: string[]) {
  const newObj = {}
  for (const key of keys) {
    (newObj as any)[key] = obj[key]
  }
  return newObj
}
