import type { FetchError, FetchOptions, ResponseType as _ResponseType } from 'ofetch'
import type { $Fetch, H3Event$Fetch, NitroFetchRequest, TypedInternalResponse, AvailableRouterMethod as _AvailableRouterMethod } from 'nitropack/types'
import type { MaybeRef, MaybeRefOrGetter, Ref } from 'vue'
import { computed, reactive, toValue, watch } from 'vue'
import { hash } from 'ohash'

import { isPlainObject } from '@vue/shared'
import { useRequestFetch } from './ssr'
import type { AsyncData, AsyncDataOptions, KeysOf, MultiWatchSources, PickFrom } from './asyncData'
import { useAsyncData } from './asyncData'

// @ts-expect-error virtual file
import { alwaysRunFetchOnKeyChange, fetchDefaults } from '#build/nuxt.config.mjs'

// support uppercase methods, detail: https://github.com/nuxt/nuxt/issues/22313
type AvailableRouterMethod<R extends NitroFetchRequest> = _AvailableRouterMethod<R> | Uppercase<_AvailableRouterMethod<R>>

export type FetchResult<ReqT extends NitroFetchRequest, M extends AvailableRouterMethod<ReqT>> = TypedInternalResponse<ReqT, unknown, Lowercase<M>>

type ComputedOptions<T extends Record<string, any>> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T]: T[K] extends Function ? T[K] : ComputedOptions<T[K]> | Ref<T[K]> | T[K]
}

interface NitroFetchOptions<R extends NitroFetchRequest, M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>, DataT = any> extends FetchOptions<_ResponseType, DataT> {
  method?: M
}

type ComputedFetchOptions<R extends NitroFetchRequest, M extends AvailableRouterMethod<R>, DataT = any> = ComputedOptions<NitroFetchOptions<R, M, DataT>>

export interface UseFetchOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
  R extends NitroFetchRequest = string & {},
  M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>,
> extends Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'watch'>, ComputedFetchOptions<R, M, DataT> {
  key?: MaybeRefOrGetter<string>
  $fetch?: typeof globalThis.$fetch
  watch?: MultiWatchSources | false
}

function generateOptionSegments<_ResT, DataT, DefaultT> (opts: UseFetchOptions<_ResT, DataT, any, DefaultT, any, any>) {
  const segments: Array<string | undefined | Record<string, string>> = [
    toValue(opts.method as MaybeRef<string | undefined> | undefined)?.toUpperCase() || 'GET',
    toValue(opts.baseURL),
  ]
  for (const _obj of [opts.params || opts.query]) {
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
      segments.push(hash(value))
    } else if (value instanceof ArrayBuffer) {
      segments.push(hash(Object.fromEntries([...new Uint8Array(value).entries()].map(([k, v]) => [k, v.toString()]))))
    } else if (value instanceof FormData) {
      const obj: Record<string, string> = {}
      for (const entry of value.entries()) {
        const [key, val] = entry
        obj[key] = val instanceof File ? val.name : val
      }
      segments.push(hash(obj))
    } else if (isPlainObject(value)) {
      segments.push(hash(reactive(value)))
    } else {
      try {
        segments.push(hash(value))
      } catch {
        console.warn('[useFetch] Failed to hash body', value)
      }
    }
  }
  return segments
}

interface CreateUseFetchOptions<
  ResT = void,
  ReqT extends NitroFetchRequest = NitroFetchRequest,
  Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
  _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
  DataT = _ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
> {
  defaults: Partial<UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>>
}

/**
 * Create a custom useFetch composable with the given default options.
 * @since 4.0.0
 * @param options The options for the useFetch composable
 */
export function createUseFetch<
  CResT = void,
  CReqT extends NitroFetchRequest = NitroFetchRequest,
  CMethod extends AvailableRouterMethod<CReqT> = CResT extends void ? 'get' extends AvailableRouterMethod<CReqT> ? 'get' : AvailableRouterMethod<CReqT> : AvailableRouterMethod<CReqT>,
  C_ResT = CResT extends void ? FetchResult<CReqT, CMethod> : CResT,
  CDataT = C_ResT,
  CPickKeys extends KeysOf<CDataT> = KeysOf<CDataT>,
  CDefaultT = undefined,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
> (options:
    Partial<CreateUseFetchOptions<CResT, CReqT, CMethod, C_ResT, CDataT, CPickKeys, CDefaultT>>
    | (() => Partial<CreateUseFetchOptions<CResT, CReqT, CMethod, C_ResT, CDataT, CPickKeys, CDefaultT>>) = {},
): ReturnType<typeof _createUseFetch<CResT, CReqT, CMethod, C_ResT, CDataT, CPickKeys, CDefaultT>> {
  if (!import.meta.dev) { return undefined as any }
  throw new Error(
    '[nuxt] [createUseFetch] `createUseFetch` is a compiler macro that is only usable inside ' +
    // TODO: add link to docs about this factory function
    'the `composables` directory as an exported function. For more information, see `https://nuxt.com/TODO`.',
  )
}

/**
 * Internal function to create useFetch, which replaces the public `createUseFetch` compiler macro.
 */
export function _createUseFetch<
  CResT = void,
  CReqT extends NitroFetchRequest = NitroFetchRequest,
  CMethod extends AvailableRouterMethod<CReqT> = CResT extends void ? 'get' extends AvailableRouterMethod<CReqT> ? 'get' : AvailableRouterMethod<CReqT> : AvailableRouterMethod<CReqT>,
  C_ResT = CResT extends void ? FetchResult<CReqT, CMethod> : CResT,
  CDataT = C_ResT,
  CPickKeys extends KeysOf<CDataT> = KeysOf<CDataT>,
  CDefaultT = undefined,
> (options:
    Partial<CreateUseFetchOptions<CResT, CReqT, CMethod, C_ResT, CDataT, CPickKeys, CDefaultT>>
    | (() => Partial<CreateUseFetchOptions<CResT, CReqT, CMethod, C_ResT, CDataT, CPickKeys, CDefaultT>>) = {},
) {
  /**
   * Fetch data from an API endpoint with an SSR-friendly composable.
   * See {@link https://nuxt.com/docs/api/composables/use-fetch}
   * @since 3.0.0
   * @param request The URL to fetch
   * @param opts extends $fetch options and useAsyncData options
   */
  function useFetch<
    ResT = void,
    ErrorT = FetchError,
    ReqT extends NitroFetchRequest = NitroFetchRequest,
    Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
    _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = undefined,
  > (
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  function useFetch<
    ResT = void,
    ErrorT = FetchError,
    ReqT extends NitroFetchRequest = NitroFetchRequest,
    Method extends AvailableRouterMethod<ReqT> = ResT extends void ? 'get' extends AvailableRouterMethod<ReqT> ? 'get' : AvailableRouterMethod<ReqT> : AvailableRouterMethod<ReqT>,
    _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = DataT,
  > (
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  function useFetch<
    ResT = void,
    ErrorT = FetchError,
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

    const _request = computed(() => toValue(request))

    const key = computed(() => toValue(opts.key) || ('$f' + hash([autoKey, typeof _request.value === 'string' ? _request.value : '', ...generateOptionSegments(opts)])))

    if (!opts.baseURL && typeof _request.value === 'string' && (_request.value[0] === '/' && _request.value[1] === '/')) {
      throw new Error('[nuxt] [useFetch] the request URL must not start with "//".')
    }

    const factoryOptions = typeof options === 'function' ? options() : options

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
      ...fetchOptions
    } = {
      ...factoryOptions.defaults as Partial<typeof opts>,
      ...opts,
    }

    const _fetchOptions = reactive<typeof fetchOptions>({
      ...fetchDefaults,
      ...fetchOptions,
      cache: typeof opts.cache === 'boolean' ? undefined : opts.cache,
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
      watch: watchSources === false ? [] : [...(watchSources || []), _fetchOptions],
    }

    if (import.meta.dev) {
    // @ts-expect-error private property
      _asyncDataOptions._functionName ||= 'useFetch'
    }

    if (alwaysRunFetchOnKeyChange && !immediate) {
    // ensure that updates to watched sources trigger an update
      function setImmediate () {
        _asyncDataOptions.immediate = true
      }
      watch(key, setImmediate, { flush: 'sync', once: true })
      watch([...watchSources || [], _fetchOptions], setImmediate, { flush: 'sync', once: true })
    }

    let controller: AbortController

    const asyncData = useAsyncData<_ResT, ErrorT, DataT, PickKeys, DefaultT>(watchSources === false ? key.value : key, () => {
      controller?.abort?.(new DOMException('Request aborted as another request to the same endpoint was initiated.', 'AbortError'))
      controller = typeof AbortController !== 'undefined' ? new AbortController() : {} as AbortController

      /**
       * Workaround for `timeout` not working due to custom abort controller
       * TODO: remove this when upstream issue is resolved
       * @see https://github.com/unjs/ofetch/issues/326
       * @see https://github.com/unjs/ofetch/blob/bb2d72baa5d3f332a2185c20fc04e35d2c3e258d/src/fetch.ts#L152
       */
      const timeoutLength = toValue(opts.timeout)
      let timeoutId: NodeJS.Timeout
      if (timeoutLength) {
        timeoutId = setTimeout(() => controller.abort(new DOMException('Request aborted due to timeout.', 'AbortError')), timeoutLength)
        controller.signal.onabort = () => clearTimeout(timeoutId)
      }

      let _$fetch: H3Event$Fetch | $Fetch<unknown, NitroFetchRequest> = opts.$fetch || globalThis.$fetch

      // Use fetch with request context and headers for server direct API calls
      if (import.meta.server && !opts.$fetch) {
        const isLocalFetch = typeof _request.value === 'string' && _request.value[0] === '/' && (!toValue(opts.baseURL) || toValue(opts.baseURL)![0] === '/')
        if (isLocalFetch) {
          _$fetch = useRequestFetch()
        }
      }

      return _$fetch(_request.value, { signal: controller.signal, ..._fetchOptions } as any).finally(() => { clearTimeout(timeoutId) }) as Promise<_ResT>
    }, _asyncDataOptions)

    return asyncData
  }

  return useFetch
}

export const useFetch = _createUseFetch()

export const useLazyFetch = _createUseFetch({
  defaults: {
    lazy: true,
    // @ts-expect-error private property
    _functionName: 'useLazyFetch',
  },
})
