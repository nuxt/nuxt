import type { FetchError, FetchOptions } from 'ofetch'
import type { TypedInternalResponse, NitroFetchRequest } from 'nitropack'
import { computed, unref, Ref, reactive } from 'vue'
import { hash } from 'ohash'
import type { AsyncDataOptions, _Transform, KeyOfRes, AsyncData, PickFrom } from './asyncData'
import { useAsyncData } from './asyncData'

export type FetchResult<ReqT extends NitroFetchRequest> = TypedInternalResponse<ReqT, unknown>

type ComputedOptions<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends Function ? T[K] : T[K] extends Record<string, any> ? ComputedOptions<T[K]> | Ref<T[K]> | T[K] : Ref<T[K]> | T[K]
}

type ComputedFetchOptions = ComputedOptions<FetchOptions>

export interface UseFetchOptions<
  DataT,
  Transform extends _Transform<DataT, any> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> extends AsyncDataOptions<DataT, Transform, PickKeys>, ComputedFetchOptions {
  key?: string
}

export function useFetch<
  ResT = void,
  ErrorT = FetchError,
  ReqT extends NitroFetchRequest = NitroFetchRequest,
  _ResT = ResT extends void ? FetchResult<ReqT> : ResT,
  Transform extends (res: _ResT) => any = (res: _ResT) => _ResT,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  request: Ref<ReqT> | ReqT | (() => ReqT),
  opts?: UseFetchOptions<_ResT, Transform, PickKeys>
): AsyncData<PickFrom<ReturnType<Transform>, PickKeys>, ErrorT | null>
export function useFetch<
  ResT = void,
  ErrorT = FetchError,
  ReqT extends NitroFetchRequest = NitroFetchRequest,
  _ResT = ResT extends void ? FetchResult<ReqT> : ResT,
  Transform extends (res: _ResT) => any = (res: _ResT) => _ResT,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  request: Ref<ReqT> | ReqT | (() => ReqT),
  arg1?: string | UseFetchOptions<_ResT, Transform, PickKeys>,
  arg2?: string
) {
  const [opts = {}, autoKey] = typeof arg1 === 'string' ? [{}, arg1] : [arg1, arg2]
  const _key = opts.key || hash([autoKey, unref(opts.baseURL), typeof request === 'string' ? request : '', unref(opts.params)])
  if (!_key || typeof _key !== 'string') {
    throw new TypeError('[nuxt] [useFetch] key must be a string: ' + _key)
  }
  if (!request) {
    throw new Error('[nuxt] [useFetch] request is missing.')
  }
  const key = _key === autoKey ? '$f' + _key : _key

  const _request = computed(() => {
    let r = request
    if (typeof r === 'function') {
      r = r()
    }
    return unref(r)
  })

  const {
    server,
    lazy,
    default: defaultFn,
    transform,
    pick,
    watch,
    immediate,
    ...fetchOptions
  } = opts

  const _fetchOptions = reactive({
    ...fetchOptions,
    cache: typeof opts.cache === 'boolean' ? undefined : opts.cache
  })

  const _asyncDataOptions: AsyncDataOptions<_ResT, Transform, PickKeys> = {
    server,
    lazy,
    default: defaultFn,
    transform,
    pick,
    immediate,
    watch: [
      _fetchOptions,
      _request,
      ...(watch || [])
    ]
  }

  let controller: AbortController

  const asyncData = useAsyncData<_ResT, ErrorT, Transform, PickKeys>(key, () => {
    controller?.abort?.()
    controller = typeof AbortController !== 'undefined' ? new AbortController() : {} as AbortController
    return $fetch(_request.value, { signal: controller.signal, ..._fetchOptions }) as Promise<_ResT>
  }, _asyncDataOptions)

  return asyncData
}

export function useLazyFetch<
  ResT = void,
  ErrorT = FetchError,
  ReqT extends NitroFetchRequest = NitroFetchRequest,
  _ResT = ResT extends void ? FetchResult<ReqT> : ResT,
  Transform extends (res: _ResT) => any = (res: _ResT) => _ResT,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  request: Ref<ReqT> | ReqT | (() => ReqT),
  opts?: Omit<UseFetchOptions<_ResT, Transform, PickKeys>, 'lazy'>
): AsyncData<PickFrom<ReturnType<Transform>, PickKeys>, ErrorT | null>
export function useLazyFetch<
  ResT = void,
  ErrorT = FetchError,
  ReqT extends NitroFetchRequest = NitroFetchRequest,
  _ResT = ResT extends void ? FetchResult<ReqT> : ResT,
  Transform extends (res: _ResT) => any = (res: _ResT) => _ResT,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  request: Ref<ReqT> | ReqT | (() => ReqT),
  arg1?: string | Omit<UseFetchOptions<_ResT, Transform, PickKeys>, 'lazy'>,
  arg2?: string
) {
  const [opts, autoKey] = typeof arg1 === 'string' ? [{}, arg1] : [arg1, arg2]

  return useFetch<ResT, ErrorT, ReqT, _ResT, Transform, PickKeys>(request, {
    ...opts,
    lazy: true
  },
  // @ts-ignore
  autoKey)
}
