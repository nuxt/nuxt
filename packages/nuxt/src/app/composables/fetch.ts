import type { FetchOptions, ResponseType as _ResponseType } from 'ofetch'
import type { AcceptedDeclaredMethod, AcceptedMethod, AnyServerRouteMethod, DeclaredFetchRequest, DeclaredRequestShape, DeclaredServerResponse, EffectiveBaseURL, RequiredDeclaredBody, RequiredFetchBody, ResolvedFetchPath, TypedFetch, TypedFetchPathInput, TypedFetchRequest, TypedRequestShape, TypedServerResponse, UnmatchedDeclaredRouteArgs, UnmatchedRouteArgs, ValidDeclaredFetchPath, ValidTypedFetchPath } from '../types/fetch'
import type { MaybeRef, MaybeRefOrGetter, Ref } from 'vue'
import { computed, reactive, toValue, watch } from 'vue'
import { isPlainObject } from '@vue/shared'
import { hashKey } from '../utils/hash'
import type { AsyncData, AsyncDataOptions, KeysOf, MultiWatchSources, PickFrom, _Transform } from './asyncData'
import { useAsyncData } from './asyncData'
import { useRequestFetch } from './ssr'
import { dataDiagnostics } from '../diagnostics/data'
import type { NuxtError } from './error'
import { defineKeyedFunctionFactory } from '../../compiler/runtime'

import { alwaysRunFetchOnKeyChange, fetchDefaults, routeTypedFetch } from '#build/nuxt.config.mjs'
import { $fetch as _$fetch } from '#build/fetch'

const $fetch = _$fetch as TypedFetch

// both cases are accepted at a call site, and a parameter constrained to one cannot infer the
// other, detail: https://github.com/nuxt/nuxt/issues/22313

export type FetchResult<ReqT, M extends AnyServerRouteMethod> = TypedServerResponse<ReqT, unknown, M>

type ComputedOptions<T extends Record<string, any>> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T]: T[K] extends Function ? T[K] : ComputedOptions<T[K]> | MaybeRefOrGetter<T[K]>
}

type NuxtFetchOptions<R, M extends AnyServerRouteMethod = 'get', DataT = any, B extends string = string> =
  & Omit<FetchOptions<_ResponseType, DataT>, 'baseURL' | 'cache' | 'method' | 'body' | 'query' | 'params' | 'headers'>
  & {
    // the base is part of the path the request is made to, so it is inferred here and resolved
    // against the route set along with the request
    baseURL?: B
    method?: AcceptedMethod<R, M>
    cache?: FetchOptions<_ResponseType, DataT>['cache'] | false
  }
  & TypedRequestShape<R, M>

type ComputedFetchOptions<R, M extends AnyServerRouteMethod, DataT = any, B extends string = string> = ComputedOptions<NuxtFetchOptions<R, M, DataT, B>>

export interface UseFetchOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
  R extends string = string,
  M extends AnyServerRouteMethod = 'get',
  B extends string = string,
> extends Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'watch'>, Omit<ComputedFetchOptions<R, M, DataT, B>, 'timeout'> {
  key?: MaybeRefOrGetter<string>
  $fetch?: TypedFetch
  watch?: MultiWatchSources | false
}

export interface UseFetchOptionsWithTransform<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
  R extends string = string,
  M extends AnyServerRouteMethod = 'get',
  B extends string = string,
> extends Omit<UseFetchOptions<ResT, DataT, PickKeys, DefaultT, R, M, B>, 'transform'> {
  transform: _Transform<ResT, DataT>
}

const MAYBE_REF_OR_GETTER_OPTION_KEYS = ['method', 'baseURL', 'query', 'params', 'body', 'headers'] as const

function generateOptionSegments (opts: Record<string, any>) {
  const segments: Array<string | undefined | Record<string, string>> = [
    toValue(opts.method as MaybeRef<string | undefined> | undefined)?.toUpperCase() || 'GET',
    toValue(opts.baseURL),
  ]
  for (const _obj of [opts.query || opts.params]) {
    const obj = toValue<Record<string, any> | undefined>(_obj)
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
        dataDiagnostics.NUXT_E3002({ cause: value })
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
export interface UseFetch<FDataT = unknown, FPickKeys extends KeysOf<FDataT> = never[], FDefaultT = undefined, FBaseURL extends string = ''> {
  // the registered paths come first: an editor takes string-literal completions from the first
  // applicable signature. Their request parameter is left un-intersected, because intersecting a
  // validator onto it stops a template literal argument from inferring as one; a path the route set
  // does not answer with this method is turned away by the trailing `UnmatchedRouteArgs` instead,
  // which drops these signatures and leaves the call to the validating ones below.
  // Auto-key, opts with transform, default = undefined
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchRequest = TypedFetchRequest,
    // `'get'` only while `ResT` is being inferred. Naming any type argument turns inference off for
    // every later one, so a flat default would leave `Method` at `'get'` and reject the method the
    // call passed. Widening it once `ResT` is named costs nothing, because at that point the method
    // no longer decides what comes back.
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    // the base is part of the path requested, so it is resolved into `_ReqT` and everything the
    // route set is asked - the response, the request shapes, whether the path resolves at all -
    // is asked of that rather than of the path as written
    const BaseURL extends string = '',
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, undefined>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts: UseFetchOptionsWithTransform<_ResT, DataT, PickKeys, DefaultT, _ReqT & string, Method, BaseURL> & RequiredFetchBody<_ReqT, Method>,
    ...unmatched: UnmatchedRouteArgs<_ReqT, Method>
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  // Auto-key, opts with transform, default = DataT
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchRequest = TypedFetchRequest,
    // `'get'` only while `ResT` is being inferred. Naming any type argument turns inference off for
    // every later one, so a flat default would leave `Method` at `'get'` and reject the method the
    // call passed. Widening it once `ResT` is named costs nothing, because at that point the method
    // no longer decides what comes back.
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    // the base is part of the path requested, so it is resolved into `_ReqT` and everything the
    // route set is asked - the response, the request shapes, whether the path resolves at all -
    // is asked of that rather than of the path as written
    const BaseURL extends string = '',
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, DataT>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts: UseFetchOptionsWithTransform<_ResT, DataT, PickKeys, DefaultT, _ReqT & string, Method, BaseURL> & RequiredFetchBody<_ReqT, Method>,
    ...unmatched: UnmatchedRouteArgs<_ReqT, Method>
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  // Auto-key, default = undefined
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchRequest = TypedFetchRequest,
    // `'get'` only while `ResT` is being inferred. Naming any type argument turns inference off for
    // every later one, so a flat default would leave `Method` at `'get'` and reject the method the
    // call passed. Widening it once `ResT` is named costs nothing, because at that point the method
    // no longer decides what comes back.
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    // the base is part of the path requested, so it is resolved into `_ReqT` and everything the
    // route set is asked - the response, the request shapes, whether the path resolves at all -
    // is asked of that rather than of the path as written
    const BaseURL extends string = '',
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = FetchFactoryDataT<FDataT, _ResT>,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, undefined>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, _ReqT & string, Method, BaseURL> & RequiredFetchBody<_ReqT, Method>,
    ...unmatched: UnmatchedRouteArgs<_ReqT, Method>
  ): AsyncData<PickFrom<DataT, FetchFactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, ErrorT | undefined>
  // Auto-key, default = DataT
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchRequest = TypedFetchRequest,
    // `'get'` only while `ResT` is being inferred. Naming any type argument turns inference off for
    // every later one, so a flat default would leave `Method` at `'get'` and reject the method the
    // call passed. Widening it once `ResT` is named costs nothing, because at that point the method
    // no longer decides what comes back.
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    // the base is part of the path requested, so it is resolved into `_ReqT` and everything the
    // route set is asked - the response, the request shapes, whether the path resolves at all -
    // is asked of that rather than of the path as written
    const BaseURL extends string = '',
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = FetchFactoryDataT<FDataT, _ResT>,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, DataT>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, _ReqT & string, Method, BaseURL> & RequiredFetchBody<_ReqT, Method>,
    ...unmatched: UnmatchedRouteArgs<_ReqT, Method>
  ): AsyncData<PickFrom<DataT, FetchFactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, ErrorT | undefined>
  // Explicit auto-key as positional arg
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchRequest = TypedFetchRequest,
    // `'get'` only while `ResT` is being inferred. Naming any type argument turns inference off for
    // every later one, so a flat default would leave `Method` at `'get'` and reject the method the
    // call passed. Widening it once `ResT` is named costs nothing, because at that point the method
    // no longer decides what comes back.
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    // the base is part of the path requested, so it is resolved into `_ReqT` and everything the
    // route set is asked - the response, the request shapes, whether the path resolves at all -
    // is asked of that rather than of the path as written
    const BaseURL extends string = '',
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = undefined,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    arg1?: string | (UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, _ReqT & string, Method, BaseURL> & RequiredFetchBody<_ReqT, Method>),
    arg2?: string,
    ...unmatched: UnmatchedRouteArgs<_ReqT, Method>
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  // the same five for a path known only at runtime, carrying the validator so an unregistered
  // path is named, and picking up the query strings and trailing slashes a constraint cannot express
  // Auto-key, opts with transform, default = undefined
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchPathInput = TypedFetchPathInput,
    // `'get'` only while `ResT` is being inferred. Naming any type argument turns inference off for
    // every later one, so a flat default would leave `Method` at `'get'` and reject the method the
    // call passed. Widening it once `ResT` is named costs nothing, because at that point the method
    // no longer decides what comes back.
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    // the base is part of the path requested, so it is resolved into `_ReqT` and everything the
    // route set is asked - the response, the request shapes, whether the path resolves at all -
    // is asked of that rather than of the path as written
    const BaseURL extends string = '',
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, undefined>,
  >(
    request: (Ref<ReqT> | ReqT | (() => ReqT)) & ValidTypedFetchPath<_ReqT, Method>,
    opts: UseFetchOptionsWithTransform<_ResT, DataT, PickKeys, DefaultT, _ReqT & string, Method, BaseURL> & RequiredFetchBody<_ReqT, Method>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  // Auto-key, opts with transform, default = DataT
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchPathInput = TypedFetchPathInput,
    // `'get'` only while `ResT` is being inferred. Naming any type argument turns inference off for
    // every later one, so a flat default would leave `Method` at `'get'` and reject the method the
    // call passed. Widening it once `ResT` is named costs nothing, because at that point the method
    // no longer decides what comes back.
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    // the base is part of the path requested, so it is resolved into `_ReqT` and everything the
    // route set is asked - the response, the request shapes, whether the path resolves at all -
    // is asked of that rather than of the path as written
    const BaseURL extends string = '',
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, DataT>,
  >(
    request: (Ref<ReqT> | ReqT | (() => ReqT)) & ValidTypedFetchPath<_ReqT, Method>,
    opts: UseFetchOptionsWithTransform<_ResT, DataT, PickKeys, DefaultT, _ReqT & string, Method, BaseURL> & RequiredFetchBody<_ReqT, Method>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  // Auto-key, default = undefined
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchPathInput = TypedFetchPathInput,
    // `'get'` only while `ResT` is being inferred. Naming any type argument turns inference off for
    // every later one, so a flat default would leave `Method` at `'get'` and reject the method the
    // call passed. Widening it once `ResT` is named costs nothing, because at that point the method
    // no longer decides what comes back.
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    // the base is part of the path requested, so it is resolved into `_ReqT` and everything the
    // route set is asked - the response, the request shapes, whether the path resolves at all -
    // is asked of that rather than of the path as written
    const BaseURL extends string = '',
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = FetchFactoryDataT<FDataT, _ResT>,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, undefined>,
  >(
    request: (Ref<ReqT> | ReqT | (() => ReqT)) & ValidTypedFetchPath<_ReqT, Method>,
    opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, _ReqT & string, Method, BaseURL> & RequiredFetchBody<_ReqT, Method>,
  ): AsyncData<PickFrom<DataT, FetchFactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, ErrorT | undefined>
  // Auto-key, default = DataT
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchPathInput = TypedFetchPathInput,
    // `'get'` only while `ResT` is being inferred. Naming any type argument turns inference off for
    // every later one, so a flat default would leave `Method` at `'get'` and reject the method the
    // call passed. Widening it once `ResT` is named costs nothing, because at that point the method
    // no longer decides what comes back.
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    // the base is part of the path requested, so it is resolved into `_ReqT` and everything the
    // route set is asked - the response, the request shapes, whether the path resolves at all -
    // is asked of that rather than of the path as written
    const BaseURL extends string = '',
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = FetchFactoryDataT<FDataT, _ResT>,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, DataT>,
  >(
    request: (Ref<ReqT> | ReqT | (() => ReqT)) & ValidTypedFetchPath<_ReqT, Method>,
    opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, _ReqT & string, Method, BaseURL> & RequiredFetchBody<_ReqT, Method>,
  ): AsyncData<PickFrom<DataT, FetchFactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, ErrorT | undefined>
  // Explicit auto-key as positional arg
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends TypedFetchPathInput = TypedFetchPathInput,
    // `'get'` only while `ResT` is being inferred. Naming any type argument turns inference off for
    // every later one, so a flat default would leave `Method` at `'get'` and reject the method the
    // call passed. Widening it once `ResT` is named costs nothing, because at that point the method
    // no longer decides what comes back.
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    // the base is part of the path requested, so it is resolved into `_ReqT` and everything the
    // route set is asked - the response, the request shapes, whether the path resolves at all -
    // is asked of that rather than of the path as written
    const BaseURL extends string = '',
    _ReqT = ResolvedFetchPath<ReqT, EffectiveBaseURL<FBaseURL, BaseURL>>,
    _ResT = ResT extends void ? FetchResult<_ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = undefined,
  >(
    request: (Ref<ReqT> | ReqT | (() => ReqT)) & ValidTypedFetchPath<_ReqT, Method>,
    arg1?: string | (UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, _ReqT & string, Method, BaseURL> & RequiredFetchBody<_ReqT, Method>),
    arg2?: string,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
}

/** The response a request to `ReqT` resolves to, against a route set a client declares. */
export type DeclaredFetchResult<Schema, ReqT, M extends AnyServerRouteMethod> = DeclaredServerResponse<Schema, ReqT, unknown, M>

type DeclaredFetchOptionsBase<Schema, R, M extends AnyServerRouteMethod = 'get', DataT = any> =
  & Omit<FetchOptions<_ResponseType, DataT>, 'cache' | 'method' | 'body' | 'query' | 'params' | 'headers'>
  & {
    method?: AcceptedDeclaredMethod<Schema, R, M>
    cache?: FetchOptions<_ResponseType, DataT>['cache'] | false
  }
  & DeclaredRequestShape<Schema, R, M>

/**
 * As {@link UseFetchOptions}, for a client that declared the route set it serves.
 *
 * `baseURL` stays ofetch's own: the declared paths are the ones the API documents, so they are
 * matched as written and the base is transport rather than part of the route.
 */
export interface DeclaredUseFetchOptions<
  Schema,
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
  R = string,
  M extends AnyServerRouteMethod = 'get',
> extends Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'watch'>, Omit<ComputedOptions<DeclaredFetchOptionsBase<Schema, R, M, DataT>>, 'timeout'> {
  key?: MaybeRefOrGetter<string>
  $fetch?: TypedFetch
  watch?: MultiWatchSources | false
  /**
   * The routes this client serves, read as a type only.
   *
   * Pass `{} as MyRoutes` - by hand, or an interface a generator emitted from an OpenAPI document -
   * and every request the composable makes is resolved against that route set instead of the app's
   * own. The value is dropped before the request is made.
   */
  routes?: Schema
}

export interface DeclaredUseFetchOptionsWithTransform<
  Schema,
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
  R = string,
  M extends AnyServerRouteMethod = 'get',
> extends Omit<DeclaredUseFetchOptions<Schema, ResT, DataT, PickKeys, DefaultT, R, M>, 'transform'> {
  transform: _Transform<ResT, DataT>
}

/**
 * The composable {@link createUseFetch} returns for a client that declared its own route set.
 *
 * The same shapes as {@link UseFetch}, resolved against `Schema`. A path outside that set is turned
 * away by the trailing `UnmatchedDeclaredRouteArgs`, exactly as an unregistered path is for the
 * app's own routes.
 */
export interface DeclaredUseFetch<Schema, FDataT = unknown, FPickKeys extends KeysOf<FDataT> = never[], FDefaultT = undefined> {
  // Auto-key, opts with transform, default = undefined
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends DeclaredFetchRequest<Schema> = DeclaredFetchRequest<Schema>,
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    _ResT = ResT extends void ? DeclaredFetchResult<Schema, ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, undefined>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts: DeclaredUseFetchOptionsWithTransform<Schema, _ResT, DataT, PickKeys, DefaultT, ReqT, Method> & RequiredDeclaredBody<Schema, ReqT, Method>,
    ...unmatched: UnmatchedDeclaredRouteArgs<Schema, ReqT, Method>
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  // Auto-key, opts with transform, default = DataT
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends DeclaredFetchRequest<Schema> = DeclaredFetchRequest<Schema>,
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    _ResT = ResT extends void ? DeclaredFetchResult<Schema, ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, DataT>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts: DeclaredUseFetchOptionsWithTransform<Schema, _ResT, DataT, PickKeys, DefaultT, ReqT, Method> & RequiredDeclaredBody<Schema, ReqT, Method>,
    ...unmatched: UnmatchedDeclaredRouteArgs<Schema, ReqT, Method>
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  // Auto-key, default = undefined
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends DeclaredFetchRequest<Schema> = DeclaredFetchRequest<Schema>,
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    _ResT = ResT extends void ? DeclaredFetchResult<Schema, ReqT, Method> : ResT,
    DataT = FetchFactoryDataT<FDataT, _ResT>,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, undefined>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts?: DeclaredUseFetchOptions<Schema, _ResT, DataT, PickKeys, DefaultT, ReqT, Method> & RequiredDeclaredBody<Schema, ReqT, Method>,
    ...unmatched: UnmatchedDeclaredRouteArgs<Schema, ReqT, Method>
  ): AsyncData<PickFrom<DataT, FetchFactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, ErrorT | undefined>
  // Auto-key, default = DataT
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends DeclaredFetchRequest<Schema> = DeclaredFetchRequest<Schema>,
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    _ResT = ResT extends void ? DeclaredFetchResult<Schema, ReqT, Method> : ResT,
    DataT = FetchFactoryDataT<FDataT, _ResT>,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = FetchFactoryDefaultT<FDefaultT, DataT>,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    opts?: DeclaredUseFetchOptions<Schema, _ResT, DataT, PickKeys, DefaultT, ReqT, Method> & RequiredDeclaredBody<Schema, ReqT, Method>,
    ...unmatched: UnmatchedDeclaredRouteArgs<Schema, ReqT, Method>
  ): AsyncData<PickFrom<DataT, FetchFactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, ErrorT | undefined>
  // Explicit auto-key as positional arg
  <
    ResT = void,
    ErrorT = NuxtError<unknown>,
    ReqT extends DeclaredFetchRequest<Schema> = DeclaredFetchRequest<Schema>,
    const Method extends AnyServerRouteMethod = ResT extends void ? 'get' : AnyServerRouteMethod,
    _ResT = ResT extends void ? DeclaredFetchResult<Schema, ReqT, Method> : ResT,
    DataT = _ResT,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = undefined,
  >(
    request: Ref<ReqT> | ReqT | (() => ReqT),
    arg1?: string | (DeclaredUseFetchOptions<Schema, _ResT, DataT, PickKeys, DefaultT, ReqT, Method> & RequiredDeclaredBody<Schema, ReqT, Method>),
    arg2?: string,
    ...unmatched: UnmatchedDeclaredRouteArgs<Schema, ReqT, Method>
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
  // Last, and only applicable where the path does not resolve, so a call the signatures above turned
  // away is reported as the path and method that matched nothing rather than as the argument count
  // their trailing tuple asked for. The guard keeps it out of the way of a resolving call, which
  // this signature would otherwise answer with looser options than the route declares
  <
    ReqT extends string,
    const Method extends AnyServerRouteMethod = 'get',
  >(
    request: (Ref<ReqT> | ReqT | (() => ReqT)) & ValidDeclaredFetchPath<Schema, ReqT, Method>,
    opts?: { method?: Method },
    key?: string,
    ...resolves: unknown extends ValidDeclaredFetchPath<Schema, ReqT, Method> ? [never] : []
  ): AsyncData<unknown, NuxtError<unknown> | undefined>
}

export interface CreateUseFetch {
  // a client for another API: `routes` is required here, so this signature is only reached by a call
  // that declares one, and every other call resolves against the app's own routes as before
  <
    FSchema,
    FResT = void,
    FReqT extends DeclaredFetchRequest<FSchema> = DeclaredFetchRequest<FSchema>,
    const FMethod extends AnyServerRouteMethod = 'get',
    F_ResT = FResT extends void ? DeclaredFetchResult<FSchema, FReqT, FMethod> : FResT,
    FDataT = F_ResT,
    FPickKeys extends KeysOf<FDataT> = KeysOf<FDataT>,
    FDefaultT = undefined,
  >(
    options: Partial<DeclaredUseFetchOptions<FSchema, F_ResT, FDataT, FPickKeys, FDefaultT, FReqT, FMethod>> & { routes: FSchema },
  ): DeclaredUseFetch<FSchema, FDataT, FPickKeys, FDefaultT>
  <
    FResT = void,
    FReqT extends TypedFetchRequest = TypedFetchRequest,
    const FMethod extends AnyServerRouteMethod = 'get',
    // a `baseURL` the factory sets applies to every call the composable it returns makes, so it is
    // carried on the returned type and resolved there. A base passed at the call site wins, as it
    // does at runtime
    const FBaseURL extends string = '',
    F_ResT = FResT extends void ? FetchResult<FReqT, FMethod> : FResT,
    FDataT = F_ResT,
    FPickKeys extends KeysOf<FDataT> = KeysOf<FDataT>,
    FDefaultT = undefined,
  >(
    options?:
      | Partial<UseFetchOptions<F_ResT, FDataT, FPickKeys, FDefaultT, FReqT & string, FMethod, FBaseURL>>
      | ((callerOptions: UseFetchOptions<unknown>) => Partial<UseFetchOptions<F_ResT, FDataT, FPickKeys, FDefaultT, FReqT & string, FMethod, FBaseURL>>),
  ): UseFetch<FDataT, FPickKeys, FDefaultT, FBaseURL>
}

/**
 * A factory function to create a custom `useFetch` composable with pre-defined default options.
 * @since 4.2.0
 */
export const createUseFetch: CreateUseFetch = defineKeyedFunctionFactory<CreateUseFetch>({
  name: 'createUseFetch',
  factory<
    FResT = void,
    FReqT extends TypedFetchRequest = TypedFetchRequest,
    const FMethod extends AnyServerRouteMethod = 'get',
    F_ResT = FResT extends void ? FetchResult<FReqT, FMethod> : FResT,
    FDataT = F_ResT,
    FPickKeys extends KeysOf<FDataT> = KeysOf<FDataT>,
    FDefaultT = undefined,
  >(options:
      Partial<UseFetchOptions<F_ResT, FDataT, FPickKeys, FDefaultT, FReqT & string, FMethod>>
      | ((callerOptions: UseFetchOptions<unknown>) => Partial<UseFetchOptions<F_ResT, FDataT, FPickKeys, FDefaultT, FReqT & string, FMethod>>) = {},
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
      ReqT extends TypedFetchRequest = TypedFetchRequest,
      Method extends AnyServerRouteMethod = ResT extends void ? 'get' extends AnyServerRouteMethod ? 'get' : AnyServerRouteMethod : AnyServerRouteMethod,
      _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
      DataT = _ResT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = [undefined] extends [FDefaultT] ? undefined : FDefaultT,
    > (
      request: Ref<ReqT> | ReqT | (() => ReqT),
      opts: UseFetchOptionsWithTransform<_ResT, DataT, PickKeys, DefaultT, ReqT & string, Method>,
    ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
    function useFetch<
      ResT = void,
      ErrorT = NuxtError<unknown>,
      ReqT extends TypedFetchRequest = TypedFetchRequest,
      Method extends AnyServerRouteMethod = ResT extends void ? 'get' extends AnyServerRouteMethod ? 'get' : AnyServerRouteMethod : AnyServerRouteMethod,
      _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
      DataT = _ResT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = [undefined] extends [FDefaultT] ? DataT : FDefaultT,
    > (
      request: Ref<ReqT> | ReqT | (() => ReqT),
      opts: UseFetchOptionsWithTransform<_ResT, DataT, PickKeys, DefaultT, ReqT & string, Method>,
    ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | undefined>
    function useFetch<
      ResT = void,
      ErrorT = NuxtError<unknown>,
      ReqT extends TypedFetchRequest = TypedFetchRequest,
      Method extends AnyServerRouteMethod = ResT extends void ? 'get' extends AnyServerRouteMethod ? 'get' : AnyServerRouteMethod : AnyServerRouteMethod,
      _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
      DataT = [unknown] extends [FDataT] ? _ResT : FDataT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = [undefined] extends [FDefaultT] ? undefined : FDefaultT,
    > (
      request: Ref<ReqT> | ReqT | (() => ReqT),
      opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT & string, Method>,
    ): AsyncData<PickFrom<DataT, [Array<never>] extends [FPickKeys] ? PickKeys : FPickKeys & KeysOf<DataT>> | DefaultT, ErrorT | undefined>
    function useFetch<
      ResT = void,
      ErrorT = NuxtError<unknown>,
      ReqT extends TypedFetchRequest = TypedFetchRequest,
      Method extends AnyServerRouteMethod = ResT extends void ? 'get' extends AnyServerRouteMethod ? 'get' : AnyServerRouteMethod : AnyServerRouteMethod,
      _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
      DataT = [unknown] extends [FDataT] ? _ResT : FDataT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = [undefined] extends [FDefaultT] ? DataT : FDefaultT,
    > (
      request: Ref<ReqT> | ReqT | (() => ReqT),
      opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT & string, Method>,
    ): AsyncData<PickFrom<DataT, [Array<never>] extends [FPickKeys] ? PickKeys : FPickKeys & KeysOf<DataT>> | DefaultT, ErrorT | undefined>
    function useFetch<
      ResT = void,
      ErrorT = NuxtError<unknown>,
      ReqT extends TypedFetchRequest = TypedFetchRequest,
      Method extends AnyServerRouteMethod = ResT extends void ? 'get' extends AnyServerRouteMethod ? 'get' : AnyServerRouteMethod : AnyServerRouteMethod,
      _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
      DataT = _ResT,
      PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
      DefaultT = undefined,
    > (
      request: Ref<ReqT> | ReqT | (() => ReqT),
      arg1?: string | UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT & string, Method>,
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
        enabled,
        serialize,
        ...fetchOptions
      } = {
        ...(typeof options === 'function' ? {} : factoryOptions),
        ...opts,
        ...(typeof options === 'function' ? factoryOptions : {}),
      }

      // `params` is an alias for `query` while requests are typed from nitro's `InternalApi`, and
      // is dropped once they are typed from the route set, which frees the name for named route
      // parameters
      if (routeTypedFetch && 'params' in fetchOptions) {
        delete (fetchOptions as { params?: unknown }).params
        if (import.meta.dev) {
          dataDiagnostics.NUXT_E3010()
        }
      }

      const _request = computed(() => toValue(request))

      const key = computed(() => toValue(fetchOptions.key) || ('$f' + hashKey([autoKey, typeof _request.value === 'string' ? _request.value : '', ...generateOptionSegments(fetchOptions)])))

      if (!fetchOptions.baseURL && typeof _request.value === 'string' && (_request.value[0] === '/' && _request.value[1] === '/')) {
        throw dataDiagnostics.NUXT_E3001({ url: _request.value })
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
        enabled,
        serialize,
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
        // Typed as a plain callable rather than `TypedFetch`: unioning/comparing two route-mapped fetch instantiations blows the recursion limit under nitropack v2's typed-route matcher.
        let _$fetch: (request: unknown, options?: any) => Promise<unknown> = fetchOptions.$fetch || $fetch

        // Use fetch with request context and headers for server direct API calls
        if (import.meta.server && !fetchOptions.$fetch) {
          const isLocalFetch = typeof _request.value === 'string' && _request.value[0] === '/' && (!toValue(fetchOptions.baseURL) || toValue(fetchOptions.baseURL)![0] === '/')
          if (isLocalFetch) {
            _$fetch = useRequestFetch()
          }
        }

        const resolvedOptions = { signal, ..._fetchOptions } as Record<string, unknown>
        for (const key of MAYBE_REF_OR_GETTER_OPTION_KEYS) {
          if (typeof resolvedOptions[key] === 'function') {
            resolvedOptions[key] = toValue(resolvedOptions[key] as () => unknown)
          }
        }

        return _$fetch(_request.value, resolvedOptions) as Promise<_ResT>
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

export type { AnyServerRouteMethod, AvailableServerRouteMethod, ServerRouteMethod, ServerRouteMethods, TypedFetch, TypedFetch as $Fetch, TypedFetchOptions, TypedFetchRequest, TypedServerError, TypedServerResponse } from '../types/fetch'
