import { computed, getCurrentInstance, getCurrentScope, inject, isShallow, nextTick, onBeforeMount, onScopeDispose, onServerPrefetch, onUnmounted, queuePostFlushCb, ref, shallowRef, toRef, toValue, unref, watch } from 'vue'
import type { MaybeRefOrGetter, MultiWatchSources, Ref } from 'vue'
import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import type { NuxtApp } from '../nuxt'
import { useNuxtApp } from '../nuxt'
import { getUserCaller, toArray } from '../utils'
import { clientOnlySymbol } from '../components/client-only'
import type { NuxtError } from './error'
import { createError } from './error'
import { onNuxtReady } from './ready'
import { defineKeyedFunctionFactory } from '../../compiler/runtime'

// @ts-expect-error virtual file
import { asyncDataDefaults, granularCachedData, pendingWhenIdle, purgeCachedData } from '#build/nuxt.config.mjs'

export type AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error'

export type _Transform<Input = any, Output = any> = (input: Input) => Output | Promise<Output>

export type AsyncDataHandler<ResT> = (nuxtApp: NuxtApp, options: { signal: AbortSignal }) => Promise<ResT>

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
  /**
   * A timeout in milliseconds after which the request will be aborted if it has not resolved yet.
   */
  timeout?: number
}

export interface AsyncDataExecuteOptions {
  /**
   * Force a refresh, even if there is already a pending request. Previous requests will
   * not be cancelled, but their result will not affect the data/pending state - and any
   * previously awaited promises will not resolve until this new request resolves.
   */
  dedupe?: 'cancel' | 'defer'

  cause?: AsyncDataRefreshCause

  /** @internal */
  cachedData?: any

  signal?: AbortSignal

  timeout?: number
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

export const createUseAsyncData = defineKeyedFunctionFactory({
  name: 'createUseAsyncData',
  factory<
    FResT,
    FDataT = FResT,
    FPickKeys extends KeysOf<FDataT> = KeysOf<FDataT>,
    FDefaultT = undefined,
  >(options:
    Partial<AsyncDataOptions<FResT, FDataT, FPickKeys, FDefaultT>>
    | ((currentOptions: AsyncDataOptions<unknown>) => Partial<AsyncDataOptions<FResT, FDataT, FPickKeys, FDefaultT>>) = {},
  ) {
    /**
     * Provides access to data that resolves asynchronously in an SSR-friendly composable.
     * See {@link https://nuxt.com/docs/4.x/api/composables/use-async-data}
     * @since 3.0.0
     * @param handler An asynchronous function that must return a truthy value (for example, it should not be `undefined` or `null`) or the request may be duplicated on the client side.
     * @param opts customize the behavior of useAsyncData
     */
    function useAsyncData<
      ResT,
      NuxtErrorDataT = unknown,
      DataT = ResT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = undefined,
    > (
      handler: AsyncDataHandler<ResT>,
      opts?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>,
    ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>
    function useAsyncData<
      ResT,
      NuxtErrorDataT = unknown,
      DataT = ResT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = DataT,
    > (
      handler: AsyncDataHandler<ResT>,
      opts?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>,
    ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>
    /**
     * Provides access to data that resolves asynchronously in an SSR-friendly composable.
     * See {@link https://nuxt.com/docs/4.x/api/composables/use-async-data}
     * @param key A unique key to ensure that data fetching can be properly de-duplicated across requests.
     * @param handler An asynchronous function that must return a truthy value (for example, it should not be `undefined` or `null`) or the request may be duplicated on the client side.
     * @param opts customize the behavior of useAsyncData
     */
    function useAsyncData<
      ResT,
      NuxtErrorDataT = unknown,
      DataT = ResT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = undefined,
    > (
      key: MaybeRefOrGetter<string>,
      handler: AsyncDataHandler<ResT>,
      opts?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>,
    ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>
    function useAsyncData<
      ResT,
      NuxtErrorDataT = unknown,
      DataT = ResT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = DataT,
    > (
      key: MaybeRefOrGetter<string>,
      handler: AsyncDataHandler<ResT>,
      opts?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>,
    ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined>
    function useAsyncData<
      ResT,
      NuxtErrorDataT = unknown,
      DataT = ResT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = undefined,
    > (...args: any[]): AsyncData<PickFrom<DataT, PickKeys>, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>) | undefined> {
      const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
      if (_isAutoKeyNeeded(args[0], args[1])) { args.unshift(autoKey) }

      // eslint-disable-next-line prefer-const
      let [_key, _handler, opts = {}] = args as [string, AsyncDataHandler<ResT>, AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>]
      let keyChanging = false

      // Validate arguments
      const key = computed(() => toValue(_key)!)
      if (typeof key.value !== 'string') {
        throw new TypeError('[nuxt] [useAsyncData] key must be a string.')
      }
      if (typeof _handler !== 'function') {
        throw new TypeError('[nuxt] [useAsyncData] handler must be a function.')
      }

      const shouldFactoryOptionsOverride = typeof options === 'function'
      // const factoryOptions = (shouldFactoryOptionsOverride ? options(opts as any) : defu(opts, options)) as typeof opts

      // Setup nuxt instance payload
      const nuxtApp = useNuxtApp()

      const factoryOptions = shouldFactoryOptionsOverride ? options(opts as any) : options
      // assign factory defaults
      if (!shouldFactoryOptionsOverride) {
        for (const key in factoryOptions) {
          // factory doesn't have a value set for the key
          if (factoryOptions[key as keyof typeof factoryOptions] === undefined) { continue }
          // opts already has a value set for the key
          if (opts[key as keyof typeof opts] !== undefined) { continue }
          opts[key as keyof typeof opts] = factoryOptions[key as keyof typeof factoryOptions] as any
        }
      }

      opts.server ??= true
      opts.default ??= getDefault as () => DefaultT
      opts.getCachedData ??= getDefaultCachedData

      opts.lazy ??= false
      opts.immediate ??= true
      opts.deep ??= asyncDataDefaults.deep
      opts.dedupe ??= 'cancel'

      // assign overrides from factory
      if (shouldFactoryOptionsOverride) {
        for (const key in factoryOptions) {
          if (factoryOptions[key as keyof typeof factoryOptions] === undefined) { continue }
          opts[key as keyof typeof opts] = factoryOptions[key as keyof typeof factoryOptions] as any
        }
      }

      // internal property
      const functionName = (factoryOptions as typeof factoryOptions & { _functionName?: string })._functionName || 'useAsyncData'

      // check and warn if different defaults/fetcher are provided
      const currentData = nuxtApp._asyncData[key.value]
      if (import.meta.dev && currentData) {
        const warnings: string[] = []
        const values = createHash(_handler, opts)
        if (values.handler !== currentData._hash?.handler) {
          warnings.push(`different handler`)
        }
        for (const opt of ['transform', 'pick', 'getCachedData'] as const) {
          if (values[opt] !== currentData._hash![opt]) {
            warnings.push(`different \`${opt}\` option`)
          }
        }
        if (currentData._default.toString() !== opts.default.toString()) {
          warnings.push(`different \`default\` value`)
        }
        if (opts.deep && isShallow(currentData.data)) {
          warnings.push(`mismatching \`deep\` option`)
        }
        if (warnings.length) {
          const caller = getUserCaller()
          const explanation = caller ? ` (used at ${caller.source}:${caller.line}:${caller.column})` : ''
          console.warn(`[nuxt] [${functionName}] Incompatible options detected for "${key.value}"${explanation}:\n${warnings.map(w => `- ${w}`).join('\n')}\nYou can use a different key or move the call to a composable to ensure the options are shared across calls.`)
        }
      }

      // Create or use a shared asyncData entity
      function createInitialFetch () {
        const initialFetchOptions: AsyncDataExecuteOptions = { cause: 'initial', dedupe: opts.dedupe }
        if (!nuxtApp._asyncData[key.value]?._init) {
          initialFetchOptions.cachedData = opts.getCachedData!(key.value, nuxtApp, { cause: 'initial' })
          nuxtApp._asyncData[key.value] = buildAsyncData(nuxtApp, key.value, _handler, opts, initialFetchOptions.cachedData)
        }
        return () => nuxtApp._asyncData[key.value]!.execute(initialFetchOptions)
      }

      const initialFetch = createInitialFetch()
      const asyncData = nuxtApp._asyncData[key.value]!

      asyncData._deps++

      const fetchOnServer = opts.server !== false && nuxtApp.payload.serverRendered

      // Server side
      if (import.meta.server && fetchOnServer && opts.immediate) {
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
        if (instance && fetchOnServer && opts.immediate && !instance.sp) {
          // @ts-expect-error - internal vue property. This force vue to mark the component as async boundary client-side to avoid useId hydration issue since we treeshake onServerPrefetch
          instance.sp = []
        }
        if (import.meta.dev && !nuxtApp.isHydrating && !nuxtApp._processingMiddleware /* internal flag */ && (!instance || instance?.isMounted)) {
          console.warn(`[nuxt] [${functionName}] Component is already mounted, please use $fetch instead. See https://nuxt.com/docs/4.x/getting-started/data-fetching`)
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

        if (fetchOnServer && nuxtApp.isHydrating && (asyncData.error.value || asyncData.data.value !== undefined)) {
          // 1. Hydration (server: true): no fetch
          if (pendingWhenIdle) {
            asyncData.pending.value = false
          }
          asyncData.status.value = asyncData.error.value ? 'error' : 'success'
        } else if (instance && ((!isWithinClientOnly && nuxtApp.payload.serverRendered && nuxtApp.isHydrating) || opts.lazy) && opts.immediate) {
          // 2. Initial load (server: false): fetch on mounted
          // 3. Initial load or navigation (lazy: true): fetch on mounted
          instance._nuxtOnBeforeMountCbs.push(initialFetch)
        } else if (opts.immediate && asyncData.status.value !== 'success') {
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
            }
          }
        }

        // setup watchers/instance
        const hasScope = getCurrentScope()
        // Key watcher: react immediately to key changes to remount/migrate the async data container deterministically.
        const unsubKeyWatcher = watch(key, (newKey, oldKey) => {
          if ((newKey || oldKey) && newKey !== oldKey) {
            keyChanging = true

            const hadData = nuxtApp._asyncData[oldKey]?.data.value !== undefined
            const wasRunning = nuxtApp._asyncDataPromises[oldKey] !== undefined

            const initialFetchOptions: AsyncDataExecuteOptions = { cause: 'initial', dedupe: opts.dedupe }

            // Ensure destination container exists; read/migrate value BEFORE unregistering the old key.
            if (!nuxtApp._asyncData[newKey]?._init) {
              let initialValue: NoInfer<DataT> | undefined

              if (oldKey && hadData) {
                initialValue = nuxtApp._asyncData[oldKey]!.data.value as NoInfer<DataT>
              } else {
                initialValue = opts.getCachedData!(newKey, nuxtApp, { cause: 'initial' })
                initialFetchOptions.cachedData = initialValue
              }

              nuxtApp._asyncData[newKey] = buildAsyncData(nuxtApp, newKey, _handler, opts, initialValue)
            }

            nuxtApp._asyncData[newKey]._deps++

            // Now it's safe to drop the old container.
            if (oldKey) {
              unregister(oldKey)
            }

            // Trigger the fetch for the new key if needed.
            if (opts.immediate || hadData || wasRunning) {
              nuxtApp._asyncData[newKey].execute(initialFetchOptions)
            }

            // Release the guard after the current flush to avoid overlapping executes.
            queuePostFlushCb(() => {
              keyChanging = false
            })
          }
        }, { flush: 'sync' })

        // Params/deps watcher: keep default (pre) flush to batch multiple mutations into a single execute.
        // This preserves the "non synchronous" behavior covered by tests.
        const unsubParamsWatcher = opts.watch
          ? watch(opts.watch, () => {
              if (keyChanging) { return } // avoid double execute while the key switch is being processed
              // if the 0ms debounce is pending (same tick) force flush the debounce post watcher flush
              if (nuxtApp._asyncData[key.value]?._execute.isPending()) {
                queuePostFlushCb(() => {
                  nuxtApp._asyncData[key.value]?._execute.flush()
                })
              }
              nuxtApp._asyncData[key.value]?._execute({ cause: 'watch', dedupe: opts.dedupe })
            })
          : () => {}

        if (hasScope) {
          onScopeDispose(() => {
            unsubKeyWatcher()
            unsubParamsWatcher()
            unregister(key.value)
          })
        }
      }

      const asyncReturn: _AsyncData<ResT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)> = {
        data: writableComputedRef(() => nuxtApp._asyncData[key.value]?.data as Ref<ResT>),
        pending: writableComputedRef(() => nuxtApp._asyncData[key.value]?.pending as Ref<boolean>),
        status: writableComputedRef(() => nuxtApp._asyncData[key.value]?.status as Ref<AsyncDataRequestStatus>),
        error: writableComputedRef(() => nuxtApp._asyncData[key.value]?.error as Ref<NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>>),
        refresh: (...args) => {
          if (!nuxtApp._asyncData[key.value]?._init) {
            const initialFetch = createInitialFetch()
            return initialFetch()
          }
          return nuxtApp._asyncData[key.value]!.execute(...args)
        },
        execute: (...args) => asyncReturn.refresh(...args),
        clear: () => {
          const entry = nuxtApp._asyncData[key.value]
          if (entry?._abortController) {
            try {
              entry._abortController.abort(new DOMException('AsyncData aborted by user.', 'AbortError'))
            } finally {
              entry._abortController = undefined
            }
          }
          clearNuxtDataByKey(nuxtApp, key.value)
        },
      }

      // Allow directly awaiting on asyncData
      const asyncDataPromise = Promise.resolve(nuxtApp._asyncDataPromises[key.value]).then(() => asyncReturn) as AsyncData<ResT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)>
      Object.assign(asyncDataPromise, asyncReturn)

      return asyncDataPromise as AsyncData<PickFrom<DataT, PickKeys>, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)>
    }

    return useAsyncData
  },
})

export const useAsyncData = (createUseAsyncData as unknown as { __nuxt_factory: typeof createUseAsyncData }).__nuxt_factory()

export const useLazyAsyncData = (createUseAsyncData as unknown as { __nuxt_factory: typeof createUseAsyncData }).__nuxt_factory({
  lazy: true,
  // @ts-expect-error private property
  _functionName: 'useLazyAsyncData',
})

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

function _isAutoKeyNeeded (keyOrFetcher: string | MaybeRefOrGetter<string> | (() => any), fetcher: () => any): boolean {
  // string key
  if (typeof keyOrFetcher === 'string') {
    return false
  }
  // ref or computed key
  if (typeof keyOrFetcher === 'object' && keyOrFetcher !== null) {
    return false
  }
  // getter key only if it's followed by a getter function
  if (typeof keyOrFetcher === 'function' && typeof fetcher === 'function') {
    return false
  }
  return true
}

/** @since 3.1.0 */
export function useNuxtData<DataT = any> (key: string): { data: Ref<DataT | undefined> } {
  const nuxtApp = useNuxtApp()

  // Initialize value when key is not already set
  if (!(key in nuxtApp.payload.data)) {
    nuxtApp.payload.data[key] = undefined
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
    nuxtApp.payload._errors[key] = undefined
  }

  if (nuxtApp._asyncData[key]) {
    nuxtApp._asyncData[key]!.data.value = unref(nuxtApp._asyncData[key]!._default())
    nuxtApp._asyncData[key]!.error.value = undefined
    if (pendingWhenIdle) {
      nuxtApp._asyncData[key]!.pending.value = false
    }
    nuxtApp._asyncData[key]!.status.value = 'idle'
  }

  if (key in nuxtApp._asyncDataPromises) {
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

// TODO: export from `perfect-debounce`
export type DebouncedReturn<ArgumentsT extends unknown[], ReturnT> = ((...args: ArgumentsT) => Promise<ReturnT>) & {
  cancel: () => void
  flush: () => Promise<ReturnT> | undefined
  isPending: () => boolean
}

export type CreatedAsyncData<ResT, NuxtErrorDataT = unknown, DataT = ResT, DefaultT = undefined> = Omit<_AsyncData<DataT | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)>, 'clear' | 'refresh'> & { _off: () => void, _hash?: Record<string, string | undefined>, _default: () => unknown, _init: boolean, _deps: number, _execute: DebouncedReturn<[opts?: AsyncDataExecuteOptions | undefined], void>, _abortController?: AbortController }

function buildAsyncData<
  ResT,
  NuxtErrorDataT = unknown,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
> (nuxtApp: NuxtApp, key: string, _handler: AsyncDataHandler<ResT>, options: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, initialCachedData?: NoInfer<DataT>): CreatedAsyncData<ResT, NuxtErrorDataT, DataT, DefaultT> {
  nuxtApp.payload._errors[key] ??= undefined

  const hasCustomGetCachedData = options.getCachedData !== getDefaultCachedData

  // When prerendering, share payload data automatically between requests
  const handler: AsyncDataHandler<ResT> = import.meta.client || !import.meta.prerender || !nuxtApp.ssrContext?.['~sharedPrerenderCache']
    ? _handler
    : (nuxtApp, options) => {
        const value = nuxtApp.ssrContext!['~sharedPrerenderCache']!.get(key)
        if (value) { return value as Promise<ResT> }

        const promise = Promise.resolve().then(() => nuxtApp.runWithContext(() => _handler(nuxtApp, options)))

        nuxtApp.ssrContext!['~sharedPrerenderCache']!.set(key, promise)
        return promise
      }

  const _ref = options.deep ? ref : shallowRef
  const hasCachedData = initialCachedData !== undefined
  const unsubRefreshAsyncData = nuxtApp.hook('app:data:refresh', async (keys) => {
    if (!keys || keys.includes(key)) {
      await asyncData.execute({ cause: 'refresh:hook' })
    }
  })
  const asyncData: CreatedAsyncData<ResT, NuxtErrorDataT, DataT, DefaultT> = {
    data: _ref(hasCachedData ? initialCachedData : options.default!()) as any,
    pending: pendingWhenIdle ? shallowRef(!hasCachedData) : computed(() => asyncData.status.value === 'pending'),
    error: toRef(nuxtApp.payload._errors, key) as any,
    status: shallowRef('idle'),
    execute: (...args) => {
      const [_opts, newValue = undefined] = args
      const opts = _opts && newValue === undefined && typeof _opts === 'object' ? _opts : {}
      if (import.meta.dev && newValue !== undefined && (!_opts || typeof _opts !== 'object')) {
        // @ts-expect-error private property
        console.warn(`[nuxt] [${options._functionName}] Do not pass \`execute\` directly to \`watch\`. Instead, use an inline function, such as \`watch(q, () => execute())\`.`)
      }
      if (nuxtApp._asyncDataPromises[key]) {
        if ((opts.dedupe ?? options.dedupe) === 'defer') {
        // Avoid fetching same key more than once at a time
          return nuxtApp._asyncDataPromises[key]!
        }
      }
      // Avoid fetching same key that is already fetched
      if (granularCachedData || opts.cause === 'initial' || nuxtApp.isHydrating) {
        const cachedData = 'cachedData' in opts ? opts.cachedData : options.getCachedData!(key, nuxtApp, { cause: opts.cause ?? 'refresh:manual' })
        if (cachedData !== undefined) {
          nuxtApp.payload.data[key] = asyncData.data.value = cachedData as DataT
          asyncData.error.value = undefined
          asyncData.status.value = 'success'
          return Promise.resolve(cachedData)
        }
      }
      if (pendingWhenIdle) {
        asyncData.pending.value = true
      }
      if (asyncData._abortController) {
        asyncData._abortController.abort(new DOMException('AsyncData request cancelled by deduplication', 'AbortError'))
      }
      asyncData._abortController = new AbortController()
      asyncData.status.value = 'pending'
      const cleanupController = new AbortController()
      const promise: Promise<ResT | void> = new Promise<ResT>(
        (resolve, reject) => {
          try {
            const timeout = opts.timeout ?? options.timeout
            const mergedSignal = mergeAbortSignals([asyncData._abortController?.signal, opts?.signal], cleanupController.signal, timeout)
            if (mergedSignal.aborted) {
              const reason = mergedSignal.reason
              reject(reason instanceof Error ? reason : new DOMException(String(reason ?? 'Aborted'), 'AbortError'))
              return
            }
            mergedSignal.addEventListener('abort', () => {
              const reason = mergedSignal.reason
              reject(reason instanceof Error ? reason : new DOMException(String(reason ?? 'Aborted'), 'AbortError'))
            }, { once: true, signal: cleanupController.signal })

            return Promise.resolve(handler(nuxtApp, { signal: mergedSignal })).then(resolve, reject)
          } catch (err) {
            reject(err)
          }
        })
        .then(async (_result) => {
          let result = _result as unknown as DataT
          if (options.transform) {
            result = await options.transform(_result)
          }
          if (options.pick) {
            result = pick(result as any, options.pick) as DataT
          }

          if (import.meta.dev && import.meta.server && typeof result === 'undefined') {
            const caller = getUserCaller()
            const explanation = caller ? ` (used at ${caller.source}:${caller.line}:${caller.column})` : ''
            // @ts-expect-error private property
            console.warn(`[nuxt] \`${options._functionName || 'useAsyncData'}${explanation}\` must return a value (it should not be \`undefined\`) or the request may be duplicated on the client side.`)
          }

          nuxtApp.payload.data[key] = result

          asyncData.data.value = result
          asyncData.error.value = undefined
          asyncData.status.value = 'success'
        })
        .catch((error: any) => {
          // If the promise was replaced by another one, we do not update the asyncData
          if (nuxtApp._asyncDataPromises[key] && nuxtApp._asyncDataPromises[key] !== promise) {
            return nuxtApp._asyncDataPromises[key]
          }

          // If the asyncData was explicitly aborted internally (dedupe or clear), we do not update the asyncData
          if (asyncData._abortController?.signal.aborted) {
            return nuxtApp._asyncDataPromises[key]
          }

          // if the asyncData was explicitly aborted by user, we set it back to idle state
          if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
            asyncData.status.value = 'idle'
            return nuxtApp._asyncDataPromises[key]
          }

          asyncData.error.value = createError<NuxtErrorDataT>(error) as (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)
          asyncData.data.value = unref(options.default!())
          asyncData.status.value = 'error'
        })
        .finally(() => {
          if (pendingWhenIdle) {
            asyncData.pending.value = false
          }
          cleanupController.abort()

          delete nuxtApp._asyncDataPromises[key]
        })
      nuxtApp._asyncDataPromises[key] = promise
      return nuxtApp._asyncDataPromises[key]!
    },
    _execute: debounce((...args) => asyncData.execute(...args), 0, { leading: true }),
    _default: options.default!,
    _deps: 0,
    _init: true,
    _hash: import.meta.dev ? createHash(_handler, options) : undefined,
    _off: () => {
      unsubRefreshAsyncData()
      if (nuxtApp._asyncData[key]?._init) {
        nuxtApp._asyncData[key]._init = false
      }
      // TODO: disable in v4 in favour of custom caching strategies
      if (purgeCachedData && !hasCustomGetCachedData) {
        nextTick(() => {
          if (!nuxtApp._asyncData[key]?._init) {
            clearNuxtDataByKey(nuxtApp, key)
            asyncData.execute = () => Promise.resolve()
          }
        })
      }
    },
  }

  return asyncData
}

// Used to get default values
const getDefault = () => undefined
const getDefaultCachedData: AsyncDataOptions<any>['getCachedData'] = (key, nuxtApp, ctx) => {
  if (nuxtApp.isHydrating) {
    return nuxtApp.payload.data[key]
  }

  if (ctx.cause !== 'refresh:manual' && ctx.cause !== 'refresh:hook') {
    return nuxtApp.static.data[key]
  }
}

function createHash (_handler: AsyncDataHandler<unknown>, options: Partial<Record<keyof AsyncDataOptions<any>, unknown>>) {
  return {
    handler: hash(_handler),
    transform: options.transform ? hash(options.transform) : undefined,
    pick: options.pick ? hash(options.pick) : undefined,
    getCachedData: options.getCachedData ? hash(options.getCachedData) : undefined,
  }
}
function mergeAbortSignals (signals: Array<AbortSignal | null | undefined>, cleanupSignal: AbortSignal, timeout?: number): AbortSignal {
  const list = signals.filter(s => !!s)
  if (typeof timeout === 'number' && timeout >= 0) {
    const timeoutSignal = AbortSignal.timeout?.(timeout)
    if (timeoutSignal) { list.push(timeoutSignal) }
  }

  // Use native if available
  if (AbortSignal.any) {
    return AbortSignal.any(list)
  }

  // Polyfill
  const controller = new AbortController()

  for (const sig of list) {
    if (sig.aborted) {
      const reason = sig.reason ?? new DOMException('Aborted', 'AbortError')
      try {
        controller.abort(reason)
      } catch {
        controller.abort()
      }
      return controller.signal
    }
  }

  const onAbort = () => {
    const abortedSignal = list.find(s => s.aborted)
    const reason = abortedSignal?.reason ?? new DOMException('Aborted', 'AbortError')
    try {
      controller.abort(reason)
    } catch {
      controller.abort()
    }
  }

  for (const sig of list) {
    sig.addEventListener?.('abort', onAbort, { once: true, signal: cleanupSignal })
  }

  return controller.signal
}
