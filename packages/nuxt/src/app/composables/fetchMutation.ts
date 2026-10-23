import type { FetchOptions, ResponseType as _ResponseType } from 'ofetch'
import type { AcceptedMethod, AnyServerRouteMethod, EffectiveBaseURL, FallbackBaseURL, RequiredRequestBody, ResolvedFetchPath, TypedFetch, TypedFetchPathInput, TypedFetchRequest, TypedRequestShape, UnmatchedRouteArgs, ValidTypedFetchPath } from '../types/fetch'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { toValue } from 'vue'
import type { FactoryDataT, FactoryDefaultT } from '../types/async-data'
import { createAsyncDataMutation, mergeFactoryOptions } from './asyncDataMutation'
import type { AsyncDataMutationExecuteOptions, AsyncDataMutationOptions, AugmentedAsyncDataMutation, FactoryOptions } from './asyncDataMutation'
import type { FetchResult } from './fetch'
import { applyUseFetchMutationAddons } from './addons'
import type { MergedAddonsExtensions, MergedAddonsOptions, UseFetchMutationAddon } from './addons'
import type { NuxtError } from './error'
import { useRequestFetch } from './ssr'
import { dataDiagnostics } from '../diagnostics/data'

import { fetchDefaults } from '#build/nuxt.config.mjs'
import { $fetch as _$fetch } from '#build/fetch'

const $fetch = _$fetch as TypedFetch

/** The `body`, `query` and `headers` a single `mutate` call sends to `Request`. */
export type FetchMutationPayload<Request, Method extends AnyServerRouteMethod> = TypedRequestShape<Request, Method>

/** The payload is required where the route declares a body a request to it cannot omit. */
export type FetchMutationArgs<Request, Method extends AnyServerRouteMethod> = unknown extends RequiredRequestBody<Request, Method>
  ? [payload?: FetchMutationPayload<Request, Method>, opts?: AsyncDataMutationExecuteOptions]
  : [payload: FetchMutationPayload<Request, Method> & RequiredRequestBody<Request, Method>, opts?: AsyncDataMutationExecuteOptions]

export interface UseFetchMutationOptions<
  ResT,
  DataT = ResT,
  DefaultT = undefined,
  R extends string = string,
  M extends AnyServerRouteMethod = 'get',
  B extends string = string,
> extends AsyncDataMutationOptions<ResT, DataT, DefaultT>, Omit<FetchOptions<_ResponseType, DataT>, 'baseURL' | 'method' | 'body' | 'query' | 'params' | 'headers' | 'signal' | 'timeout'> {
  baseURL?: B
  method?: AcceptedMethod<R, M>
  /** Merged with the `query` passed to each `mutate` call. */
  query?: TypedRequestShape<R, M>['query']
  /** Merged with the `headers` passed to each `mutate` call. */
  headers?: TypedRequestShape<R, M>['headers']
  $fetch?: TypedFetch
}

// The signatures mirror `UseFetch`: the registered paths first, for editor completions, then a path
// known only at runtime, carrying the validator so an unregistered path is named. A `baseURL` the
// factory sets is carried on the type and resolved as `UseFetch` does.
export interface UseFetchMutation<FDataT = unknown, FDefaultT = undefined, FBaseURL extends string = '', FAddonOpts = {}, FAddonExt = {}> {
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchRequest = TypedFetchRequest,
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    const BaseURL extends string = FallbackBaseURL<ReqT, TypedFetchRequest>,
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = FactoryDataT<FDataT, _ResT>,
    DefaultT = FactoryDefaultT<FDefaultT, undefined>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts?: UseFetchMutationOptions<_ResT, DataT, DefaultT, _ReqT & string, Method, BaseURL> & FAddonOpts,
    ...unmatched: UnmatchedRouteArgs<_ReqT, Method>
  ): AugmentedAsyncDataMutation<FetchMutationArgs<_ReqT, Method>, DataT | DefaultT, ErrorT, FAddonExt>
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchPathInput = TypedFetchPathInput,
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    const BaseURL extends string = FallbackBaseURL<ReqT, TypedFetchPathInput>,
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = FactoryDataT<FDataT, _ResT>,
    DefaultT = FactoryDefaultT<FDefaultT, undefined>,
  >(
    request: (Ref<ReqT> | ReqT | (() => ReqT)) & ValidTypedFetchPath<_ReqT, Method>,
    opts?: UseFetchMutationOptions<_ResT, DataT, DefaultT, _ReqT & string, Method, BaseURL> & FAddonOpts,
  ): AugmentedAsyncDataMutation<FetchMutationArgs<_ReqT, Method>, DataT | DefaultT, ErrorT, FAddonExt>
}

type CreateUseFetchMutationBaseOptions<FDataT, FDefaultT, FBaseURL extends string> = Partial<UseFetchMutationOptions<any, FDataT, FDefaultT, string, AnyServerRouteMethod, FBaseURL>>

export type CreateUseFetchMutationOptions<
  FDataT = unknown,
  FDefaultT = undefined,
  FBaseURL extends string = '',
  FAddons extends ReadonlyArray<UseFetchMutationAddon<any, any>> = [],
> = CreateUseFetchMutationBaseOptions<FDataT, FDefaultT, FBaseURL> & { addons?: FAddons }

export interface CreateUseFetchMutation {
  <FDataT = unknown, FDefaultT = undefined, const FBaseURL extends string = '', const FAddons extends ReadonlyArray<UseFetchMutationAddon<any, any>> = []>(
    options?:
      | CreateUseFetchMutationOptions<FDataT, FDefaultT, FBaseURL, FAddons>
      | ((callerOptions: UseFetchMutationOptions<unknown>) => CreateUseFetchMutationBaseOptions<FDataT, FDefaultT, FBaseURL>),
  ): UseFetchMutation<FDataT, FDefaultT, FBaseURL, MergedAddonsOptions<FAddons>, MergedAddonsExtensions<FAddons>>
}

function _createUseFetchMutation (options: FactoryOptions = {}): UseFetchMutation {
  return ((request: MaybeRefOrGetter<unknown>, opts: Record<string, any> = {}) => {
    const { default: defaultFn, transform, deep, dedupe, timeout, middleware, $fetch: customFetch, ...fetchOptions } = mergeFactoryOptions(options, opts)
    const _$fetch = (customFetch || (import.meta.server ? useRequestFetch() : $fetch)) as (request: unknown, opts: unknown) => Promise<unknown>

    if ('params' in fetchOptions) {
      delete fetchOptions.params
      if (import.meta.dev) {
        dataDiagnostics.NUXT_E3010({ fn: 'useFetchMutation' })
      }
    }

    return createAsyncDataMutation((payload: Record<string, any> | undefined, { signal }) => {
      const _request = toValue(request)
      if (!fetchOptions.baseURL && typeof _request === 'string' && _request[0] === '/' && _request[1] === '/') {
        throw dataDiagnostics.NUXT_E3001({ fn: 'useFetchMutation', url: _request })
      }
      return _$fetch(_request, {
        ...fetchDefaults,
        ...fetchOptions,
        ...payload,
        query: payload?.query ? { ...fetchOptions.query, ...payload.query } : fetchOptions.query,
        headers: mergeHeaders(fetchOptions.headers, payload?.headers),
        signal,
      })
    }, { default: defaultFn, transform, deep, dedupe, timeout, middleware })
  }) as UseFetchMutation
}

/**
 * A factory function to create a custom `useFetchMutation` composable with pre-defined default options.
 * @since 4.7.0
 */
export const createUseFetchMutation: CreateUseFetchMutation = ((options: FactoryOptions = {}) => {
  if (typeof options === 'function') {
    return _createUseFetchMutation(options)
  }
  const { addons, ...factoryOptions } = options
  return addons?.length
    ? applyUseFetchMutationAddons(_createUseFetchMutation, options)
    : _createUseFetchMutation(factoryOptions)
}) as CreateUseFetchMutation

/**
 * Send a request to an API endpoint on demand, with the `body`, `query` and `headers` passed to each
 * `mutate` call typed from the route.
 * @since 4.7.0
 * @param request The URL to send the request to
 * @param opts extends $fetch options and useAsyncDataMutation options
 */
export const useFetchMutation: UseFetchMutation = _createUseFetchMutation()

function mergeHeaders (base: HeadersInit | undefined, extra: HeadersInit | undefined) {
  if (!base || !extra) {
    return extra || base
  }
  const headers: Record<string, string> = {}
  for (const init of [base, extra]) {
    new Headers(init).forEach((value, key) => { headers[key] = value })
  }
  return headers
}
