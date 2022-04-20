import type { FetchOptions, FetchRequest } from 'ohmyfetch'
import type { TypedInternalResponse } from 'nitropack'
import { hash } from 'ohash'
import { computed, isRef, Ref } from 'vue'
import type { AsyncDataOptions, _Transform, KeyOfRes } from './asyncData'
import { useAsyncData } from './asyncData'

export type FetchResult<ReqT extends FetchRequest> = TypedInternalResponse<ReqT, unknown>

export interface UseFetchOptions<
  DataT,
  Transform extends _Transform<DataT, any> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> extends
  AsyncDataOptions<DataT, Transform, PickKeys>,
  FetchOptions
  {
  key?: string
 }

export function useFetch<
  ResT = void,
  ReqT extends FetchRequest = FetchRequest,
  _ResT = ResT extends void ? FetchResult<ReqT> : ResT,
  Transform extends (res: _ResT) => any = (res: _ResT) => _ResT,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  request: Ref<ReqT> | ReqT | (() => ReqT),
  opts: UseFetchOptions<_ResT, Transform, PickKeys> = {}
) {
  const key = '$f_' + (opts.key || hash([request, opts]))
  const _request = computed<FetchRequest>(() => {
    let r = request
    if (typeof r === 'function') {
      r = r()
    }
    return isRef(r) ? r.value : r
  })

  const _fetchOptions = {
    ...opts,
    cache: typeof opts.cache === 'boolean' ? undefined : opts.cache
  }

  const _asyncDataOptions: AsyncDataOptions<_ResT, Transform, PickKeys> = {
    ...opts,
    watch: [
      _request,
      ...(opts.watch || [])
    ]
  }

  const asyncData = useAsyncData(key, () => {
    return $fetch(_request.value, _fetchOptions) as Promise<_ResT>
  }, _asyncDataOptions)

  return asyncData
}

export function useLazyFetch<
  ResT = void,
  ReqT extends string = string,
  _ResT = ResT extends void ? FetchResult<ReqT> : ResT,
  Transform extends (res: _ResT) => any = (res: _ResT) => _ResT,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  request: Ref<ReqT> | ReqT | (() => ReqT),
  opts: Omit<UseFetchOptions<_ResT, Transform, PickKeys>, 'lazy'> = {}
) {
  return useFetch(request, { ...opts, lazy: true })
}
