import type { FetchOptions, ResponseType as _ResponseType } from 'ofetch'
import type { $Fetch, NitroFetchRequest, TypedInternalResponse, AvailableRouterMethod as _AvailableRouterMethod } from 'nitro/types'
import type { MaybeRef, MaybeRefOrGetter, Ref } from 'vue'
import { computed, reactive, toValue, watch } from 'vue'
import { isPlainObject } from '@vue/shared'
import { hashKey } from '../utils/hash'
import type { AsyncData, AsyncDataOptions, KeysOf, MultiWatchSources, PickFrom, _Transform } from './asyncData'
import { useAsyncData } from './asyncData'
import type { NuxtError } from './error'
import { defineKeyedFunctionFactory } from '../../compiler/runtime'

import { alwaysRunFetchOnKeyChange, fetchDefaults } from '#build/nuxt.config.mjs'
import { $fetch as _$fetch } from '#build/fetch'

const $fetch = _$fetch as $Fetch

// support uppercase methods, detail: https://github.com/nuxt/nuxt/issues/22313
type AvailableRouterMethod<R extends NitroFetchRequest> = _AvailableRouterMethod<R> | Uppercase<_AvailableRouterMethod<R>>

export type FetchResult<ReqT extends NitroFetchRequest, M extends AvailableRouterMethod<ReqT>> = TypedInternalResponse<ReqT, unknown, Lowercase<M>>

type ComputedOptions<T extends Record<string, any>> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T]: T[K] extends Function ? T[K] : ComputedOptions<T[K]> | MaybeRefOrGetter<T[K]>
}

interface NitroFetchOptions<R extends NitroFetchRequest, M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>, DataT = any> extends Omit<FetchOptions<_ResponseType, DataT>, 'cache'> {
  method?: M
  cache?: FetchOptions<_ResponseType, DataT>['cache'] | false
}

type ComputedFetchOptions<R extends NitroFetchRequest, M extends AvailableRouterMethod<R>, DataT = any> = ComputedOptions<NitroFetchOptions<R, M, DataT>>

export interface UseFetchOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
  R extends NitroFetchRequest = string & {},
  M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>,
> extends Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'watch'>, Omit<ComputedFetchOptions<R, M, DataT>, 'timeout'> {
  key?: MaybeRefOrGetter<string>
  $fetch?: $Fetch
  watch?: MultiWatchSources | false
}

export interface UseFetchOptionsWithTransform<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
  R extends NitroFetchRequest = string & {},
  M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>,
> extends Omit<UseFetchOptions<ResT, DataT, PickKeys, DefaultT, R, M>, 'transform'> {
  transform: _Transform<ResT, DataT>
}

const MAYBE_REF_OR_GETTER_OPTION_KEYS = ['method', 'baseURL', 'query', 'params', 'body', 'headers'] as const

function generateOptionSegments<_ResT, DataT, DefaultT> (opts: UseFetchOptions<_ResT, DataT, any, DefaultT, any, any>) {
  const segments: Array<string | undefined | Record<string, string>> = [
    toValue(opts.method as MaybeRef<string | undefined> | undefined)?.toUpperCase() || 'GET',
    toValue(opts.baseURL),
  ]
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  for (const _obj of [opts.query || opts.params]) {
    const obj = toValue(_obj)
    if (!obj) { continue }

    const unwrapped: Record<string, string> = {}
    for (const [key, value] of Object.entries(obj)) {
      unwrapped[toValue(key)] = toValue(value)
    }
    segments.push(unwrapped)
  }
  if (opts.body) {
    const value = toValue(opts.body)
    if (!value) {
      segments.push(hashKey(value))
    } else if (value instanceof ArrayBuffer) {
      segments.push(hashKey(Object.fromEntries([...new Uint8Array(value).entries()].map(([k, v]) => [k, v.toString()]))))
    } else if (value instanceof FormData) {
      const entries: Array<[string, string]> = []
      for (const entry of value.entries()) {
        const [key, val] = entry
        entries.push([key, val instanceof File ? `${val.name}:${val.size}:${val.lastModified}` : val])
      }
      segments.push(hashKey(entries))
    } else if (isPlainObject(value)) {
      // `reactive` unwraps nested refs so a body like `{ id: ref(1) }` hashes by the
      // ref's value; hashing the plain object would serialize mutable ref internals.
      segments.push(hashKey(reactive(value)))
    } else {
      try {
        segments.push(hashKey(value))
      } catch {
        console.warn('[useFetch] Failed to hash body', value)
      }
    }
  }
  return segments
}

// Type of the public-facing `useFetch` returned by the factory below.
// Expressed as a callable interface so that all overloads survive
// oxc's isolated-declarations dts pipeline.
type FetchFactoryDataT<FDataT, _ResT> = [unknown] extends [FDataT] ? _ResT : FDataT
type FetchFactoryDefaultT<FDefaultT, Fallback> = [undefined] extends [FDefaultT] ? Fallback : FDefaultT
type FetchFactoryPickKeys<FPickKeys, PickKeys, DataT> = [Array<never>] extends [FPickKeys] ? PickKeys : FPickKeys & KeysOf<DataT>
export interface UseFetch<FDataT = unknown, FPickKeys extends KeysOf<FDataT> = never[], FDefaultT = undefined> {
  // Auto-key, opts with transform, default = undefined
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends NitroFetchRequest = NitroFetchRequest,
    Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
    _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, undefined>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts: UseFetchOptionsWithTransform<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  // Auto-key, opts with transform, default = DataT
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends NitroFetchRequest = NitroFetchRequest,
    Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
    _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, DataT>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts: UseFetchOptionsWithTransform<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  // Auto-key, default = undefined
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends NitroFetchRequest = NitroFetchRequest,
    Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
    _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
    DataT = FetchFactoryDataT<FDataT, _ResT>,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, undefined>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>,
  ): AsyncData<PickFrom<DataT, FetchFactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, ErrorT | undefined>
  // Auto-key, default = DataT
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends NitroFetchRequest = NitroFetchRequest,
    Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
    _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
    DataT = FetchFactoryDataT<FDataT, _ResT>,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, DataT>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>,
  ): AsyncData<PickFrom<DataT, FetchFactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, ErrorT | undefined>
  // Explicit auto-key as positional arg
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends NitroFetchRequest = NitroFetchRequest,
    Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
    _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = undefined,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    arg1?: string | UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>,
    arg2?: string,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
}

export interface CreateUseFetch {
  <
    FResT = void,
    FReqT extends NitroFetchRequest = NitroFetchRequest,
    FMethod extends AvailableRouterMethod<FReqT> = FResT extends void ? 'get' extends AvailableRouterMethod<FReqT> ? 'get' : AvailableRouterMethod<FReqT> : AvailableRouterMethod<FReqT>,
    F_ResT = FResT extends void ? FetchResult<FReqT, FMethod> : FResT,
    FDataT = F_ResT,
    FPickKeys extends KeysOf<FDataT> = KeysOf<FDataT>,
    FDefaultT = undefined,
  >(
    options?:
      | Partial<UseFetchOptions<F_ResT, FDataT, FPickKeys, FDefaultT, FReqT, FMethod>>
      | ((callerOptions: UseFetchOptions<unknown>) => Partial<UseFetchOptions<F_ResT, FDataT, FPickKeys, FDefaultT, FReqT, FMethod>>),
  ): UseFetch<FDataT, FPickKeys, FDefaultT>
}

/**
 * A factory function to create a custom `useFetch` composable with pre-defined default options.
 * @since 4.2.0
 */
export const createUseFetch: CreateUseFetch = defineKeyedFunctionFactory<CreateUseFetch>({
  name: 'createUseFetch',
  factory<
    FResT = void,
    FReqT extends NitroFetchRequest = NitroFetchRequest,
    FMethod extends AvailableRouterMethod<FReqT> = FResT extends void ? 'get' extends AvailableRouterMethod<FReqT> ? 'get' : AvailableRouterMethod<FReqT> : AvailableRouterMethod<FReqT>,
    F_ResT = FResT extends void ? FetchResult<FReqT, FMethod> : FResT,
    FDataT = F_ResT,
    FPickKeys extends KeysOf<FDataT> = KeysOf<FDataT>,
    FDefaultT = undefined,
  >(options:
      Partial<UseFetchOptions<F_ResT, FDataT, FPickKeys, FDefaultT, FReqT, FMethod>>
      | ((callerOptions: UseFetchOptions<unknown>) => Partial<UseFetchOptions<F_ResT, FDataT, FPickKeys, FDefaultT, FReqT, FMethod>>) = {},
  ): UseFetch<FDataT, FPickKeys, FDefaultT> {
    /**
     * Fetch data from an API endpoint with an SSR-friendly composable.
     * See {@link https://nuxt.com/docs/4.x/api/composables/use-fetch}
     * @since 3.0.0
     * @param request The URL to fetch
     * @param opts extends $fetch options and useAsyncData options
     */
    function useFetch<
      ResT = void,
      ErrorT = NuxtError<unknown>,
      ReqT extends NitroFetchRequest = NitroFetchRequest,
      Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
      _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
      DataT = _ResT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = [undefined] extends [FDefaultT] ? undefined : FDefaultT,
    > (
      request: Ref<ReqT> | ReqT | (() => ReqT),
      opts: UseFetchOptionsWithTransform<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>,
    ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
    function useFetch<
      ResT = void,
      ErrorT = NuxtError<unknown>,
      ReqT extends NitroFetchRequest = NitroFetchRequest,
      Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
      _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
      DataT = _ResT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = [undefined] extends [FDefaultT] ? DataT : FDefaultT,
    > (
      request: Ref<ReqT> | ReqT | (() => ReqT),
      opts: UseFetchOptionsWithTransform<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>,
    ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
    function useFetch<
      ResT = void,
      ErrorT = NuxtError<unknown>,
      ReqT extends NitroFetchRequest = NitroFetchRequest,
      Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
      _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
      DataT = [unknown] extends [FDataT] ? _ResT : FDataT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = [undefined] extends [FDefaultT] ? undefined : FDefaultT,
    > (
      request: Ref<ReqT> | ReqT | (() => ReqT),
      opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>,
    ): AsyncData<PickFrom<DataT, [Array<never>] extends [FPickKeys] ? PickKeys : FPickKeys & KeysOf<DataT>> | DefaultT, ErrorT | undefined>
    function useFetch<
      ResT = void,
      ErrorT = NuxtError<unknown>,
      ReqT extends NitroFetchRequest = NitroFetchRequest,
      Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
      _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
      DataT = [unknown] extends [FDataT] ? _ResT : FDataT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = [undefined] extends [FDefaultT] ? DataT : FDefaultT,
    > (
      request: Ref<ReqT> | ReqT | (() => ReqT),
      opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>,
    ): AsyncData<PickFrom<DataT, [Array<never>] extends [FPickKeys] ? PickKeys : FPickKeys & KeysOf<DataT>> | DefaultT, ErrorT | undefined>
    function useFetch<
      ResT = void,
      ErrorT = NuxtError<unknown>,
      ReqT extends NitroFetchRequest = NitroFetchRequest,
      Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
      _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
      DataT = _ResT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = undefined,
    > (
      request: Ref<ReqT> | ReqT | (() => ReqT),
      arg1?: string | UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>,
      arg2?: string,
    ) {
      const [opts = {}, autoKey] = typeof arg1 === 'string' ? [{}, arg1] : [arg1, arg2]

      const factoryOptions = (typeof options === 'function' ? options(opts as any) : options) as typeof opts

      // Merge factory options with user options:
      // - defaults mode (plain object): factory < user opts (factory provides defaults)
      // - override mode (function): user opts < factory (factory overrides user opts)
      const {
        server,
        lazy,
        default: defaultFn,
        transform,
        pick,
        watch: watchSources,
        immediate,
        getCachedData,
        deep,
        dedupe,
        timeout,
        ...fetchOptions
      } = {
        ...(typeof options === 'function' ? {} : factoryOptions),
        ...opts,
        ...(typeof options === 'function' ? factoryOptions : {}),
      }

      const _request = computed(() => toValue(request))

      const key = computed(() => toValue(fetchOptions.key) || ('$f' + hashKey([autoKey, typeof _request.value === 'string' ? _request.value : '', ...generateOptionSegments(fetchOptions)])))

      if (!fetchOptions.baseURL && typeof _request.value === 'string' && (_request.value[0] === '/' && _request.value[1] === '/')) {
        throw new Error('[nuxt] [useFetch] the request URL must not start with "//".')
      }

      const _fetchOptions = reactive<typeof fetchOptions>({
        ...fetchDefaults,
        ...fetchOptions,
        cache: typeof fetchOptions.cache === 'boolean' ? undefined : fetchOptions.cache,
      })

      const _asyncDataOptions: AsyncDataOptions<_ResT, DataT, PickKeys, DefaultT> = {
        server,
        lazy,
        default: defaultFn,
        transform,
        pick,
        immediate,
        getCachedData,
        deep,
        dedupe,
        timeout,
        watch: watchSources === false ? [] : [...(watchSources || []), _fetchOptions],
      }

      if (import.meta.dev) {
        // private property
        (_asyncDataOptions as typeof _asyncDataOptions & { _functionName?: string })._functionName ||= (factoryOptions as typeof factoryOptions & { _functionName?: string })._functionName || 'useFetch'
      }

      if (watchSources === false) {
        // opt-out of automatic re-execution while keeping key reactive
        ;(_asyncDataOptions as typeof _asyncDataOptions & { _keyTriggersExecute?: boolean })._keyTriggersExecute = false
      }

      if (alwaysRunFetchOnKeyChange && !immediate) {
        // ensure that updates to watched sources trigger an update
        function setImmediate () {
          _asyncDataOptions.immediate = true
        }
        watch(key, setImmediate, { flush: 'sync', once: true })
        watch([...watchSources || [], _fetchOptions], setImmediate, { flush: 'sync', once: true })
      }

      const asyncData = useAsyncData<_ResT, ErrorT, DataT, PickKeys, DefaultT>(key, (_, { signal }) => {
        const _$fetch: $Fetch<unknown, NitroFetchRequest> = fetchOptions.$fetch || $fetch

        const resolvedOptions = { signal, ..._fetchOptions } as Record<string, unknown>
        for (const key of MAYBE_REF_OR_GETTER_OPTION_KEYS) {
          if (typeof resolvedOptions[key] === 'function') {
            resolvedOptions[key] = toValue(resolvedOptions[key] as () => unknown)
          }
        }

        return _$fetch(_request.value, resolvedOptions as any) as Promise<_ResT>
      }, _asyncDataOptions)

      return asyncData
    }

    return useFetch as unknown as UseFetch<FDataT, FPickKeys, FDefaultT>
  },
})

export const useFetch: UseFetch = (createUseFetch as unknown as { __nuxt_factory: typeof createUseFetch }).__nuxt_factory()

export const useLazyFetch: UseFetch = (createUseFetch as unknown as { __nuxt_factory: typeof createUseFetch }).__nuxt_factory({
  lazy: true,
  // @ts-expect-error private property
  _functionName: 'useLazyFetch',
}) as ReturnType<typeof createUseFetch>
