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
    ReqT extends string = string,
    ResT = FetchResult<ReqT>,
    Transform extends (res: ResT) => any = (res: ResT) => ResT,
    PickKeys extends KeyOfRes<Transform> = KeyOfRes<Transform>
  > (
  url: ReqT,
  opts: UseFetchOptions<ResT, Transform, PickKeys> = {}
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

  return useAsyncData(opts.key, () => $fetch(url, opts) as Promise<ResT>, opts)
}

function generateKey (keys) {
  return '$f' + murmurHashV3(JSON.stringify(keys))
}
