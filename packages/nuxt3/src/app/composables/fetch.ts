import type { FetchOptions } from 'ohmyfetch'
import type { $Fetch } from '@nuxt/nitro'
import type { AsyncDataOptions, _Transform, KeyOfRes } from './asyncData'
import { useAsyncData } from './asyncData'

export type Awaited<T> = T extends Promise<infer U> ? U : T
export type FetchResult<ReqT extends string> = Awaited<ReturnType<$Fetch<unknown, ReqT>>>

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

  return useAsyncData('$f' + opts.key, () => $fetch(url, opts) as Promise<ResT>, opts)
}

// TODO: More predictable universal hash
function generateKey (keys) {
  return JSON.stringify(keys).replace(/[{":}=/,]|https?:\/\//g, '_').replace(/_+/g, '_')
}
