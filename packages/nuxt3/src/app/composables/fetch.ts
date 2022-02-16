import type { FetchOptions, FetchRequest } from 'ohmyfetch'
import type { TypedInternalResponse } from '@nuxt/nitro'
import { murmurHashV3 } from 'murmurhash-es'
import type { AsyncDataOptions, _Transform, KeyOfRes } from './asyncData'
import { useAsyncData } from './asyncData'

export type FetchResult<ReqT extends FetchRequest> = TypedInternalResponse<ReqT, unknown>

export type UseFetchOptions<
  DataT,
  Transform extends _Transform<DataT, any> = _Transform<DataT, DataT>,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> = AsyncDataOptions<DataT, Transform, PickKeys> & FetchOptions & { key?: string }

export function useFetch<
  ResT = void,
  ReqT extends string = string,
  _ResT = ResT extends void ? FetchResult<ReqT> : ResT,
  Transform extends (res: _ResT) => any = (res: _ResT) => _ResT,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  url: ReqT,
  opts: UseFetchOptions<_ResT, Transform, PickKeys> = {}
) {
  if (!opts.key) {
    const keys: any = { u: url }
    if (opts.baseURL) {
      keys.b = opts.baseURL
    }
    if (opts.method && opts.method.toLowerCase() !== 'get') {
      keys.m = opts.method.toLowerCase()
    }
    if (opts.params) {
      keys.p = opts.params
    }
    opts.key = generateKey(keys)
  }

  return useAsyncData(opts.key, () => $fetch(url, opts) as Promise<_ResT>, opts)
}

export function useLazyFetch<
  ResT = void,
  ReqT extends string = string,
  _ResT = ResT extends void ? FetchResult<ReqT> : ResT,
  Transform extends (res: _ResT) => any = (res: _ResT) => _ResT,
  PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
> (
  url: ReqT,
  opts: Omit<UseFetchOptions<_ResT, Transform, PickKeys>, 'lazy'> = {}
) {
  return useFetch(url, { ...opts, lazy: true })
}

function generateKey (keys) {
  return '$f' + murmurHashV3(JSON.stringify(keys))
}
