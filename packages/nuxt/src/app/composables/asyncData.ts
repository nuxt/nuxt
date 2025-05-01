import { computed, getCurrentInstance, getCurrentScope, inject, isShallow, onBeforeMount, onScopeDispose, onServerPrefetch, onUnmounted, ref, shallowRef, toRef, toValue, unref, watch } from 'vue'
import type { MaybeRefOrGetter, MultiWatchSources, Ref } from 'vue'
import { captureStackTrace } from 'errx'
import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import type { NuxtApp } from '../nuxt'
import { useNuxtApp } from '../nuxt'
import { toArray } from '../utils'
import { clientOnlySymbol } from '../components/client-only'
import type { NuxtError } from './error'
import { createError } from './error'
import { onNuxtReady } from './ready'

// @ts-expect-error virtual file
import { asyncDataDefaults, granularCachedData, pendingWhenIdle, purgeCachedData } from '#build/nuxt.config.mjs'

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

export type { MultiWatchSources }

export type NoInfer<T> = [T][T extends any ? 0 : never]

export type AsyncDataRefreshCause = 'initial' | 'refresh:hook' | 'refresh:manual' | 'watch'

export interface AsyncDataOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
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
   * An `undefined` return value will trigger a fetch.
   * Default is `key => nuxt.isHydrating ? nuxt.payload.data[key] : nuxt.static.data[key]` which only caches data when payloadExtraction is enabled.
   */
  getCachedData?: (key: string, nuxtApp: NuxtApp, context: { cause: AsyncDataRefreshCause }) => NoInfer<DataT> | undefined
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
   * Return data in a deep ref object (it is false by default). It can be set to false to return data in a shallow ref object, which can improve performance if your data does not need to be deeply reactive.
   */
  deep?: boolean
  /**
   * Avoid fetching the same key more than once at a time
   * @default 'cancel'
   */
  dedupe?: 'cancel' | 'defer'
}

export interface AsyncDataExecuteOptions {
  /**
   * Force a refresh, even if there is already a pending request. Previous requests will
   * not be cancelled, but their result will not affect the data/pending state - and any
   * previously awaited promises will not resolve until this new request resolves.
   */
  dedupe?: 'cancel' | 'defer'

  cause?: AsyncDataRefreshCause
}

export interface _AsyncData<DataT, ErrorT> {
  data: Ref<DataT>
  pending: Ref<boolean>
  refresh: (opts?: AsyncDataExecuteOptions) => Promise<void>
  execute: (opts?: AsyncDataExecuteOptions) => Promise<void>
  clear: () => void
  error: Ref<ErrorT | undefined>
  status: Ref<AsyncDataRequestStatus>
}

export type AsyncData<Data, Error> = _AsyncData<Data, Error> & Promise<_AsyncData<Data, Error>>

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
  DefaultT = undefined,
> (
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>
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
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>
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
  DefaultT = undefined,
> (
  key: MaybeRefOrGetter<string>,
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>
/**
 * Provides access to data that resolves asynchronously in an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-async-data}
 * @param key A unique key to ensure that data fetching can be properly de-duplicated across requests.
 * @param handler An asynchronous function that must return a value (it should not be `undefined`) or the request may be duplicated on the client side.
 * @param options customize the behavior of useAsyncData
 */
export function useAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DataT,
> (
  key: MaybeRefOrGetter<string>,
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>
export function useAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
> (...args: any[]): AsyncData<PickFrom<DataT, PickKeys>, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string' && typeof args[0] !== 'object' && !(typeof args[0] === 'function' && typeof args[1] === 'function')) { args.unshift(autoKey) }

  // eslint-disable-next-line prefer-const
  let [_key, _handler, options = {}] = args as [string, (ctx?: NuxtApp) => Promise<ResT>, AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>]

  // Validate arguments
  const key = computed(() => toValue(_key)!)
  if (typeof key.value !== 'string') {
    throw new TypeError('[nuxt] [useAsyncData] key must be a string.')
  }
  if (typeof _handler !== 'function') {
    throw new TypeError('[nuxt] [useAsyncData] handler must be a function.')
  }

  // Setup nuxt instance payload
  const nuxtApp = useNuxtApp()

  // Used to get default values
  const getDefault = () => asyncDataDefaults.value
  const getDefaultCachedData: AsyncDataOptions<any>['getCachedData'] = (key, nuxtApp, ctx) => {
    if (nuxtApp.isHydrating) {
      return nuxtApp.payload.data[key]
    }

    if (ctx.cause !== 'refresh:manual' && ctx.cause !== 'refresh:hook') {
      return nuxtApp.static.data[key]
    }
  }

  // Apply defaults
  options.server ??= true
  options.default ??= getDefault as () => DefaultT
  options.getCachedData ??= getDefaultCachedData

  options.lazy ??= false
  options.immediate ??= true
  options.deep ??= asyncDataDefaults.deep
  options.dedupe ??= 'cancel'

  // @ts-expect-error private property
  const functionName = options._functionName || 'useAsyncData'

  // check and warn if different defaults/fetcher are provided
  const currentData = nuxtApp._asyncData[key.value]
  if (isDev && currentData) {
    const warnings: string[] = []
    const values = createHash(_handler, options)
    if (values.handler !== currentData._hash?.handler) {
      warnings.push(`different handler`)
    }
    for (const opt of ['transform', 'pick', 'getCachedData'] as const) {
      if (values[opt] !== currentData._hash![opt]) {
        warnings.push(`different \`${opt}\` option`)
      }
    }
    if (currentData._default.toString() !== options.default.toString()) {
      warnings.push(`different \`default\` value`)
    }
    if (options.deep && isShallow(currentData.data)) {
      warnings.push(`mismatching \`deep\` option`)
    }
    if (warnings.length) {
      const distURL = import.meta.url.replace(/\/app\/.*$/, '/app')
      const { source, line, column } = captureStackTrace().find(entry => !entry.source.startsWith(distURL)) ?? {}
      const explanation = source ? ` (used at ${source.replace(/^file:\/\//, '')}:${line}:${column})` : ''
      console.warn(`[nuxt] [${functionName}] Incompatible options detected for "${key.value}"${explanation}:\n${warnings.map(w => `- ${w}`).join('\n')}\nYou can use a different key or move the call to a composable to ensure the options are shared across calls.`)
    }
  }

  // Create or use a shared asyncData entity
  const initialCachedData = options.getCachedData!(key.value, nuxtApp, { cause: 'initial' })
  if (!nuxtApp._asyncData[key.value]?._init) {
    nuxtApp._asyncData[key.value] = createAsyncData(nuxtApp, key.value, _handler, options, initialCachedData)
  }
  const asyncData = nuxtApp._asyncData[key.value]!

  asyncData._deps++

  const initialFetch = () => nuxtApp._asyncData[key.value]!.execute({ cause: 'initial', dedupe: options.dedupe })

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

    // @ts-expect-error - instance.sp is an internal vue property
    if (instance && fetchOnServer && options.immediate && !instance.sp) {
      // @ts-expect-error - internal vue property. This force vue to mark the component as async boundary client-side to avoid useId hydration issue since we treeshake onServerPrefetch
      instance.sp = []
    }
    if (import.meta.dev && !nuxtApp.isHydrating && !nuxtApp._processingMiddleware /* internal flag */ && (!instance || instance?.isMounted)) {
      console.warn(`[nuxt] [${functionName}] Component is already mounted, please use $fetch instead. See https://nuxt.com/docs/getting-started/data-fetching`)
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

    const isWithinClientOnly = instance && (instance._nuxtClientOnly || inject(clientOnlySymbol, false))

    if (fetchOnServer && nuxtApp.isHydrating && (asyncData.error.value || typeof initialCachedData !== 'undefined')) {
      // 1. Hydration (server: true): no fetch
      if (pendingWhenIdle) {
        asyncData.pending.value = false
      }
      asyncData.status.value = asyncData.error.value ? 'error' : 'success'
    } else if (instance && !isWithinClientOnly && ((nuxtApp.payload.serverRendered && nuxtApp.isHydrating) || options.lazy) && options.immediate) {
      // 2. Initial load (server: false): fetch on mounted
      // 3. Initial load or navigation (lazy: true): fetch on mounted
      instance._nuxtOnBeforeMountCbs.push(initialFetch)
    } else if (options.immediate) {
      // 4. Navigation (lazy: false) - or plugin usage: await fetch
      initialFetch()
    }

    function unregister (key: string) {
      const data = nuxtApp._asyncData[key]
      if (data?._deps) {
        data._deps--
        // clean up memory when it no longer is needed
        if (data._deps === 0) {
          data?._off()
          data._init = false
          if (purgeCachedData) {
            clearNuxtDataByKey(nuxtApp, key)
            data.execute = () => Promise.resolve()
          }
        }
      }
    }

    // setup watchers/instance
    const hasScope = getCurrentScope()
    if (options.watch) {
      const unsubExecute = watch(options.watch, () => {
        asyncData._execute({ cause: 'watch', dedupe: options.dedupe })
      }, { flush: 'post' })
      if (hasScope) {
        onScopeDispose(() => unsubExecute())
      }
    }
    const unsubKey = watch(key, (newKey, oldKey) => {
      if (oldKey) {
        unregister(oldKey)
      }
      if (!nuxtApp._asyncData[newKey]?._init) {
        nuxtApp._asyncData[newKey] = createAsyncData(nuxtApp, newKey, _handler, options, options.getCachedData!(newKey, nuxtApp, { cause: 'initial' }))
      }
      nuxtApp._asyncData[newKey]._deps++
      if (options.immediate) {
        nuxtApp._asyncData[newKey]!.execute({ cause: 'initial', dedupe: options.dedupe })
      }
    }, { flush: 'sync' })

    if (hasScope) {
      onScopeDispose(() => {
        unsubKey()
        unregister(key.value)
      })
    }
  }

  const asyncReturn: _AsyncData<ResT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)> = {
    data: writableComputedRef(() => nuxtApp._asyncData[key.value]?.data as Ref<ResT>),
    pending: writableComputedRef(() => nuxtApp._asyncData[key.value]?.pending as Ref<boolean>),
    status: writableComputedRef(() => nuxtApp._asyncData[key.value]?.status as Ref<AsyncDataRequestStatus>),
    error: writableComputedRef(() => nuxtApp._asyncData[key.value]?.error as Ref<NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>>),
    refresh: (...args) => nuxtApp._asyncData[key.value]!.execute(...args),
    execute: (...args) => nuxtApp._asyncData[key.value]!.execute(...args),
    clear: () => clearNuxtDataByKey(nuxtApp, key.value),
  }

  // Allow directly awaiting on asyncData
  const asyncDataPromise = Promise.resolve(nuxtApp._asyncDataPromises[key.value]).then(() => asyncReturn) as AsyncData<ResT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)>
  Object.assign(asyncDataPromise, asyncReturn)

  return asyncDataPromise as AsyncData<PickFrom<DataT, PickKeys>, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)>
}

function writableComputedRef<T> (getter: () => Ref<T>) {
  return computed({
    get () {
      return getter()?.value
    },
    set (value) {
      const ref = getter()
      if (ref) {
        ref.value = value
      }
    },
  })
}

/**
 * Provides access to data that resolves asynchronously in an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-lazy-async-data}
 * @since 3.0.0
 * @param handler An asynchronous function that must return a truthy value (for example, it should not be `undefined` or `null`) or the request may be duplicated on the client side.
 * @param options customize the behavior of useLazyAsyncData
 */
export function useLazyAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
> (
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>
/**
 * Provides access to data that resolves asynchronously in an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-lazy-async-data}
 * @param handler An asynchronous function that must return a truthy value (for example, it should not be `undefined` or `null`) or the request may be duplicated on the client side.
 * @param options customize the behavior of useLazyAsyncData
 */
export function useLazyAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DataT,
> (
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>
/**
 * Provides access to data that resolves asynchronously in an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-lazy-async-data}
 * @param key A unique key to ensure that data fetching can be properly de-duplicated across requests.
 * @param handler An asynchronous function that must return a truthy value (for example, it should not be `undefined` or `null`) or the request may be duplicated on the client side.
 * @param options customize the behavior of useLazyAsyncData
 */
export function useLazyAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
> (
  key: MaybeRefOrGetter<string>,
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>
/**
 * Provides access to data that resolves asynchronously in an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-lazy-async-data}
 * @param key A unique key to ensure that data fetching can be properly de-duplicated across requests.
 * @param handler An asynchronous function that must return a value (it should not be `undefined`) or the request may be duplicated on the client side.
 * @param options customize the behavior of useLazyAsyncData
 */
export function useLazyAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DataT,
> (
  key: MaybeRefOrGetter<string>,
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>

export function useLazyAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
> (...args: any[]): AsyncData<PickFrom<DataT, PickKeys>, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') { args.unshift(autoKey) }
  const [key, handler, options = {}] = args as [string, (ctx?: NuxtApp) => Promise<ResT>, AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>]

  if (import.meta.dev) {
    // @ts-expect-error private property
    options._functionName ||= 'useLazyAsyncData'
  }

  // @ts-expect-error we pass an extra argument to prevent a key being injected
  return useAsyncData(key, handler, { ...options, lazy: true }, null)
}

/** @since 3.1.0 */
export function useNuxtData<DataT = any> (key: string): { data: Ref<DataT | undefined> } {
  const nuxtApp = useNuxtApp()

  // Initialize value when key is not already set
  if (!(key in nuxtApp.payload.data)) {
    nuxtApp.payload.data[key] = asyncDataDefaults.value
  }

  if (nuxtApp._asyncData[key]) {
    const data = nuxtApp._asyncData[key]
    data._deps++
    if (getCurrentScope()) {
      onScopeDispose(() => {
        data._deps--
        // clean up memory when it no longer is needed
        if (data._deps === 0) {
          data?._off()
          data._init = false
          if (purgeCachedData) {
            clearNuxtDataByKey(nuxtApp, key)
          }
        }
      })
    }
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
    nuxtApp.payload._errors[key] = asyncDataDefaults.errorValue
  }

  if (nuxtApp._asyncData[key]) {
    nuxtApp._asyncData[key]!.data.value = unref(nuxtApp._asyncData[key]!._default())
    nuxtApp._asyncData[key]!.error.value = asyncDataDefaults.errorValue
    if (pendingWhenIdle) {
      nuxtApp._asyncData[key]!.pending.value = false
    }
    nuxtApp._asyncData[key]!.status.value = 'idle'
  }

  if (key in nuxtApp._asyncDataPromises) {
    if (nuxtApp._asyncDataPromises[key]) {
      (nuxtApp._asyncDataPromises[key] as any).cancelled = true
    }

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

export type CreatedAsyncData<ResT, NuxtErrorDataT = unknown, DataT = ResT, DefaultT = undefined> = Omit<_AsyncData<DataT | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)>, 'clear' | 'refresh'> & { _off: () => void, _hash?: Record<string, string | undefined>, _default: () => unknown, _init: boolean, _deps: number, _execute: (opts?: AsyncDataExecuteOptions) => Promise<void> }

const isDev = import.meta.dev /* and in test */

function createAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
> (nuxtApp: NuxtApp, key: string, _handler: (ctx?: NuxtApp) => Promise<ResT>, options: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, initialCachedData?: NoInfer<DataT>): CreatedAsyncData<ResT, NuxtErrorDataT, DataT, DefaultT> {
  nuxtApp.payload._errors[key] ??= asyncDataDefaults.errorValue

  // When prerendering, share payload data automatically between requests
  const handler = import.meta.client || !import.meta.prerender || !nuxtApp.ssrContext?._sharedPrerenderCache
    ? _handler
    : () => {
        const value = nuxtApp.ssrContext!._sharedPrerenderCache!.get(key)
        if (value) { return value as Promise<ResT> }

        const promise = Promise.resolve().then(() => nuxtApp.runWithContext(_handler))

        nuxtApp.ssrContext!._sharedPrerenderCache!.set(key, promise)
        return promise
      }

  const _ref = options.deep ? ref : shallowRef
  const hasCachedData = typeof initialCachedData !== 'undefined'
  const asyncData: CreatedAsyncData<ResT, NuxtErrorDataT, DataT, DefaultT> = {
    data: _ref(hasCachedData ? initialCachedData : options.default!()) as any,
    pending: pendingWhenIdle ? shallowRef(!hasCachedData) : computed(() => asyncData.status.value === 'pending'),
    error: toRef(nuxtApp.payload._errors, key) as any,
    status: shallowRef('idle'),
    execute: (opts = {}) => {
      if (nuxtApp._asyncDataPromises[key]) {
        if ((opts.dedupe ?? options.dedupe) === 'defer') {
        // Avoid fetching same key more than once at a time
          return nuxtApp._asyncDataPromises[key]!
        }
        (nuxtApp._asyncDataPromises[key] as any).cancelled = true
      }
      // Avoid fetching same key that is already fetched
      if (granularCachedData || opts.cause === 'initial' || nuxtApp.isHydrating) {
        const cachedData = opts.cause === 'initial' ? initialCachedData : options.getCachedData!(key, nuxtApp, { cause: opts.cause ?? 'refresh:manual' })
        if (typeof cachedData !== 'undefined') {
          nuxtApp.payload.data[key] = asyncData.data.value = cachedData
          asyncData.error.value = asyncDataDefaults.errorValue
          asyncData.status.value = 'success'
          return Promise.resolve(cachedData)
        }
      }
      if (pendingWhenIdle) {
        asyncData.pending.value = true
      }
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

          if (import.meta.dev && import.meta.server && typeof result === 'undefined') {
            const stack = captureStackTrace()
            const { source, line, column } = stack[stack.length - 1] ?? {}
            const explanation = source ? ` (used at ${source.replace(/^file:\/\//, '')}:${line}:${column})` : ''
            // @ts-expect-error private property
            console.warn(`[nuxt] \`${options._functionName || 'useAsyncData'}${explanation}\` must return a value (it should not be \`undefined\`) or the request may be duplicated on the client side.`)
          }

          nuxtApp.payload.data[key] = result

          asyncData.data.value = result
          asyncData.error.value = asyncDataDefaults.errorValue
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

          if (pendingWhenIdle) {
            asyncData.pending.value = false
          }

          delete nuxtApp._asyncDataPromises[key]
        })
      nuxtApp._asyncDataPromises[key] = promise
      return nuxtApp._asyncDataPromises[key]!
    },
    _execute: debounce((...args) => asyncData.execute(...args), 0, { leading: true }),
    _default: options.default!,
    _deps: 0,
    _init: true,
    _hash: isDev ? createHash(_handler, options) : undefined,
    _off: nuxtApp.hook('app:data:refresh', async (keys) => {
      if (!keys || keys.includes(key)) {
        await asyncData.execute({ cause: 'refresh:hook' })
      }
    }),
  }

  return asyncData
}

function createHash (_handler: () => unknown, options: Partial<Record<keyof AsyncDataOptions<any>, unknown>>) {
  return {
    handler: hash(_handler),
    transform: options.transform ? hash(options.transform) : undefined,
    pick: options.pick ? hash(options.pick) : undefined,
    getCachedData: options.getCachedData ? hash(options.getCachedData) : undefined,
  }
}
