import type { FetchError, FetchOptions } from 'ofetch'
import type { $Fetch, H3Event$Fetch, NitroFetchRequest, TypedInternalResponse, AvailableRouterMethod as _AvailableRouterMethod } from 'nitro/types'
import type { MaybeRef, MaybeRefOrGetter, Ref } from 'vue'
import { computed, reactive, toValue } from 'vue'
import { hash } from 'ohash'

import { useRequestFetch } from './ssr'
import type { AsyncData, AsyncDataOptions, KeysOf, MultiWatchSources, PickFrom } from './asyncData'
import { useAsyncData } from './asyncData'

// @ts-expect-error virtual file
import { fetchDefaults } from '#build/nuxt.config.mjs'

// support uppercase methods, detail: https://github.com/nuxt/nuxt/issues/22313
type AvailableRouterMethod<R extends NitroFetchRequest> = _AvailableRouterMethod<R> | Uppercase<_AvailableRouterMethod<R>>

export type FetchResult<ReqT extends NitroFetchRequest, M extends AvailableRouterMethod<ReqT>> = TypedInternalResponse<ReqT, unknown, Lowercase<M>>

type ComputedOptions<T extends Record<string, any>> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T]: T[K] extends Function ? T[K] : ComputedOptions<T[K]> | Ref<T[K]> | T[K]
}

interface NitroFetchOptions<R extends NitroFetchRequest, M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>> extends FetchOptions {
  method?: M
}

type ComputedFetchOptions<R extends NitroFetchRequest, M extends AvailableRouterMethod<R>> = ComputedOptions<NitroFetchOptions<R, M>>

export interface UseFetchOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
  R extends NitroFetchRequest = string & {},
  M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>,
> extends Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'watch'>, ComputedFetchOptions<R, M> {
  key?: MaybeRefOrGetter<string>
  $fetch?: typeof globalThis.$fetch
  watch?: MultiWatchSources | false
}

/**
 * Fetch data from an API endpoint with an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-fetch}
 * @since 3.0.0
 * @param request The URL to fetch
 * @param opts extends $fetch options and useAsyncData options
 */
export function useFetch<
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
/**
 * Fetch data from an API endpoint with an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-fetch}
 * @param request The URL to fetch
 * @param opts extends $fetch options and useAsyncData options
 */
export function useFetch<
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
export function useFetch<
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
  if (!key.value || typeof key.value !== 'string') {
    throw new TypeError('[nuxt] [useFetch] key must be a string: ' + key.value)
  }
  if (!request) {
    throw new Error('[nuxt] [useFetch] request is missing.')
  }

  if (!opts.baseURL && typeof _request.value === 'string' && (_request.value[0] === '/' && _request.value[1] === '/')) {
    throw new Error('[nuxt] [useFetch] the request URL must not start with "//".')
  }

  const {
    server,
    lazy,
    default: defaultFn,
    transform,
    pick,
    watch,
    immediate,
    getCachedData,
    deep,
    dedupe,
    ...fetchOptions
  } = opts

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
    watch: watch === false
      ? []
      : [
          ...(watch || []),
          opts.key
            ? _fetchOptions
            : reactive({
                ..._fetchOptions,
                // these methods are included in the `key`
                method: undefined,
                baseURL: undefined,
                params: undefined,
                query: undefined,
                body: undefined,
              }),
        ],
  }

  if (import.meta.dev) {
    // @ts-expect-error private property
    _asyncDataOptions._functionName ||= 'useFetch'
  }

  let controller: AbortController

  const asyncData = useAsyncData<_ResT, ErrorT, DataT, PickKeys, DefaultT>(key, () => {
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

/**
 * Fetch data from an API endpoint with an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-lazy-fetch}
 * @since 3.0.0
 * @param request The URL to fetch
 * @param opts extends $fetch options and useAsyncData options
 */
export function useLazyFetch<
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
  opts?: Omit<UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>, 'lazy'>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
/**
 * Fetch data from an API endpoint with an SSR-friendly composable.
 * See {@link https://nuxt.com/docs/api/composables/use-lazy-fetch}
 * @param request The URL to fetch
 * @param opts extends $fetch options and useAsyncData options
 */
export function useLazyFetch<
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
  opts?: Omit<UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>, 'lazy'>
): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
export function useLazyFetch<
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
  arg1?: string | Omit<UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>, 'lazy'>,
  arg2?: string,
) {
  const [opts = {}, autoKey] = typeof arg1 === 'string' ? [{}, arg1] : [arg1, arg2]

  if (import.meta.dev) {
    // @ts-expect-error private property
    opts._functionName ||= 'useLazyFetch'
  }

  return useFetch<ResT, ErrorT, ReqT, Method, _ResT, DataT, PickKeys, DefaultT>(request, {
    ...opts,
    lazy: true,
  },
  // @ts-expect-error we pass an extra argument with the resolved auto-key to prevent another from being injected
  autoKey)
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
    segments.push(hash(toValue(opts.body)))
  }
  return segments
}
