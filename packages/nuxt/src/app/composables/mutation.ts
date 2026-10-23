import type { FetchOptions, ResponseType as _ResponseType } from 'ofetch'
import type { AcceptedMethod, AnyServerRouteMethod, EffectiveBaseURL, FallbackBaseURL, RequiredRequestBody, ResolvedFetchPath, TypedFetch, TypedFetchPathInput, TypedFetchRequest, TypedRequestShape, UnmatchedRouteArgs, ValidTypedFetchPath } from '../types/fetch'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, toValue, unref } from 'vue'
import { useNuxtApp } from '../nuxt'
import { isAbortError } from '../utils/abort'
import { runAsyncDataHandler } from '../utils/async-data'
import type { AsyncDataExecuteOptions, AsyncDataHandlerContext, AsyncDataMiddleware, AsyncDataRequestStatus, NoInfer, _Transform } from './asyncData'
import type { FetchResult } from './fetch'
import { applyUseAsyncDataMutationAddons, applyUseFetchMutationAddons } from './addons'
import type { MergedAddonsExtensions, MergedAddonsOptions, UseAsyncDataMutationAddon, UseFetchMutationAddon } from './addons'
import { createError } from './error'
import type { NuxtError } from './error'
import { useRequestFetch } from './ssr'
import { dataDiagnostics } from '../diagnostics/data'

import { asyncDataDefaults, fetchDefaults } from '#build/nuxt.config.mjs'
import { $fetch as _$fetch } from '#build/fetch'

const $fetch = _$fetch as TypedFetch

export type AsyncDataMutationHandler<InputT, ResT> = (input: InputT, ctx: AsyncDataHandlerContext) => Promise<ResT>

export interface AsyncDataMutationOptions<ResT, DataT = ResT, DefaultT = undefined> {
  /**
   * a factory function to set the default value of the data, before the first mutation resolves and after it fails
   */
  default?: () => DefaultT | Ref<DefaultT>
  /**
   * A function that can be used to alter handler function result after resolving.
   */
  transform?: _Transform<ResT, DataT>
  /**
   * Return data in a deep ref object. It can be set to false to return data in a shallow ref object.
   */
  deep?: boolean
  /**
   * What to do when `mutate` is called while a previous call is still pending
   * @default 'cancel'
   */
  dedupe?: 'cancel' | 'defer'
  /**
   * A timeout in milliseconds after which the mutation will be aborted if it has not resolved yet.
   */
  timeout?: number
  /**
   * Functions wrapping the handler; the first entry is the outermost. Call `next()` to continue or throw to abort.
   */
  middleware?: AsyncDataMiddleware<NoInfer<ResT>>[]
}

export type AsyncDataMutationExecuteOptions = Pick<AsyncDataExecuteOptions, 'dedupe' | 'signal' | 'timeout'>

export interface AsyncDataMutation<Args extends unknown[], DataT, ErrorT> {
  data: Ref<DataT>
  pending: ComputedRef<boolean>
  status: Ref<AsyncDataRequestStatus>
  error: Ref<ErrorT | undefined>
  /** Run the mutation. Like `execute`, it never rejects: a failure is reported through `error` and `status`. */
  mutate: (...args: Args) => Promise<void>
  /** Abort a pending mutation and reset `data`, `error` and `status`. */
  clear: () => void
}

export type AugmentedAsyncDataMutation<Args extends unknown[], DataT, ErrorT, Ext> = [keyof Ext] extends [never] ? AsyncDataMutation<Args, DataT, ErrorT> : AsyncDataMutation<Args, DataT, ErrorT> & Ext

type NuxtErrorFor<NuxtErrorDataT> = NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>
type FactoryDataT<FDataT, ResT> = [unknown] extends [FDataT] ? ResT : FDataT
type FactoryDefaultT<FDefaultT> = [undefined] extends [FDefaultT] ? undefined : FDefaultT

type FactoryOptions = Record<string, any> | ((callerOptions: Record<string, any>) => Record<string, any>)

// as in `useAsyncData`: a plain object provides defaults for what the caller leaves undefined,
// and a function's return value overrides the caller
function mergeFactoryOptions (options: FactoryOptions, opts: Record<string, any>) {
  const override = typeof options === 'function'
  const factoryOptions = override ? options(opts) : options
  const merged = { ...opts }
  for (const key in factoryOptions) {
    if (factoryOptions[key] !== undefined && (override || merged[key] === undefined)) {
      merged[key] = factoryOptions[key]
    }
  }
  return merged
}

function createAsyncDataMutation<ResT, InputT, NuxtErrorDataT, DataT, DefaultT> (
  handler: AsyncDataMutationHandler<InputT, ResT>,
  opts: AsyncDataMutationOptions<ResT, DataT, DefaultT>,
): AsyncDataMutation<[input: InputT, opts?: AsyncDataMutationExecuteOptions], DataT | DefaultT, NuxtErrorFor<NuxtErrorDataT>> {
  type ErrorT = NuxtErrorFor<NuxtErrorDataT>

  const nuxtApp = useNuxtApp()
  const getDefault = () => unref(opts.default?.()) as DefaultT

  const data = ((opts.deep ?? asyncDataDefaults.deep) ? ref : shallowRef)(getDefault()) as Ref<DataT | DefaultT>
  const error = shallowRef<ErrorT | undefined>()
  const status = shallowRef<AsyncDataRequestStatus>('idle')

  let current: Promise<void> | undefined
  let abortController: AbortController | undefined

  function abort (message: string) {
    abortController?.abort(new DOMException(message, 'AbortError'))
    abortController = current = undefined
  }

  function mutate (input: InputT, executeOpts: AsyncDataMutationExecuteOptions = {}): Promise<void> {
    if (current && (executeOpts.dedupe ?? opts.dedupe) === 'defer') {
      return current
    }
    abort('AsyncData mutation cancelled by deduplication')
    const controller = abortController = new AbortController()
    status.value = 'pending'

    const promise: Promise<void> = runAsyncDataHandler(
      ctx => nuxtApp.runWithContext(() => handler(input, ctx)),
      opts.middleware,
      [controller.signal, executeOpts.signal],
      executeOpts.timeout ?? opts.timeout,
    )
      .then(async (result) => {
        // superseded by a newer call, or cleared
        if (current !== promise) {
          return current
        }
        data.value = (opts.transform ? await opts.transform(result) : result) as DataT
        error.value = undefined
        status.value = 'success'
      })
      .catch((err: unknown) => {
        if (current !== promise) {
          return current
        }
        if (isAbortError(err)) {
          status.value = 'idle'
          return
        }
        error.value = createError<NuxtErrorDataT>(err as Error) as ErrorT
        data.value = getDefault()
        status.value = 'error'
      })
      .finally(() => {
        if (current === promise) {
          abortController = current = undefined
        }
      })

    current = promise
    return promise
  }

  if (getCurrentScope()) {
    onScopeDispose(() => abort('AsyncData mutation cancelled by unmount'))
  }

  return {
    data,
    pending: computed(() => status.value === 'pending'),
    status,
    error,
    mutate,
    clear: () => {
      abort('AsyncData mutation aborted by user.')
      data.value = getDefault()
      error.value = undefined
      status.value = 'idle'
    },
  }
}

export interface UseAsyncDataMutation<FDataT = unknown, FDefaultT = undefined, FAddonOpts = {}, FAddonExt = {}> {
  <ResT, InputT = void, NuxtErrorDataT = unknown, DataT = FactoryDataT<FDataT, ResT>, DefaultT = FactoryDefaultT<FDefaultT>>(
    handler: AsyncDataMutationHandler<InputT, ResT>,
    opts?: AsyncDataMutationOptions<ResT, DataT, DefaultT> & FAddonOpts,
  ): AugmentedAsyncDataMutation<[input: InputT, opts?: AsyncDataMutationExecuteOptions], DataT | DefaultT, NuxtErrorFor<NuxtErrorDataT>, FAddonExt>
}

export type CreateUseAsyncDataMutationOptions<
  FDataT = unknown,
  FDefaultT = undefined,
  FAddons extends ReadonlyArray<UseAsyncDataMutationAddon<any, any>> = [],
> = Partial<AsyncDataMutationOptions<any, FDataT, FDefaultT>> & { addons?: FAddons }

export interface CreateUseAsyncDataMutation {
  <FDataT = unknown, FDefaultT = undefined, const FAddons extends ReadonlyArray<UseAsyncDataMutationAddon<any, any>> = []>(
    options?:
      | CreateUseAsyncDataMutationOptions<FDataT, FDefaultT, FAddons>
      | ((callerOptions: AsyncDataMutationOptions<unknown>) => Partial<AsyncDataMutationOptions<any, FDataT, FDefaultT>>),
  ): UseAsyncDataMutation<FDataT, FDefaultT, MergedAddonsOptions<FAddons>, MergedAddonsExtensions<FAddons>>
}

function _createUseAsyncDataMutation (options: FactoryOptions = {}): UseAsyncDataMutation {
  return ((handler: AsyncDataMutationHandler<unknown, unknown>, opts: Record<string, any> = {}) => {
    return createAsyncDataMutation(handler, mergeFactoryOptions(options, opts))
  }) as UseAsyncDataMutation
}

/**
 * A factory function to create a custom `useAsyncDataMutation` composable with pre-defined default options.
 * @since 4.7.0
 */
export const createUseAsyncDataMutation: CreateUseAsyncDataMutation = ((options: FactoryOptions = {}) => {
  if (typeof options === 'function') {
    return _createUseAsyncDataMutation(options)
  }
  const { addons, ...factoryOptions } = options
  return addons?.length
    ? applyUseAsyncDataMutationAddons(_createUseAsyncDataMutation, options)
    : _createUseAsyncDataMutation(factoryOptions)
}) as CreateUseAsyncDataMutation

/**
 * Run an asynchronous side effect on demand, with a payload passed to each call.
 * Unlike `useAsyncData`, the state is local to the caller: it is not keyed, cached or serialized into the payload.
 * @since 4.7.0
 * @param handler An asynchronous function receiving the input passed to `mutate`
 * @param opts customize the behavior of useAsyncDataMutation
 */
export const useAsyncDataMutation: UseAsyncDataMutation = _createUseAsyncDataMutation()

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
    DefaultT = FactoryDefaultT<FDefaultT>,
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
    DefaultT = FactoryDefaultT<FDefaultT>,
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
        throw dataDiagnostics.NUXT_E3001({ url: _request })
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
