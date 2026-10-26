import type { ComputedRef, Ref } from 'vue'
import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, unref } from 'vue'
import { useNuxtApp } from '../nuxt'
import { isAbortError } from '../utils/abort'
import { runAsyncDataHandler } from '../utils/async-data'
import type { FactoryDataT, FactoryDefaultT, NuxtErrorFor } from '../types/async-data'
import type { AsyncDataExecuteOptions, AsyncDataHandlerContext, AsyncDataMiddleware, AsyncDataRequestStatus, NoInfer, _Transform } from './asyncData'
import { applyMutationAddons } from './addons'
import type { MergedAddonsExtensions, MergedAddonsOptions, UseAsyncDataMutationAddon } from './addons'
import { createError } from './error'

import { asyncDataDefaults } from '#build/nuxt.config.mjs'

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

/** @internal */
export type FactoryOptions = Record<string, any> | ((callerOptions: Record<string, any>) => Record<string, any>)

/**
 * As in `useAsyncData`: a plain object provides defaults for what the caller leaves undefined,
 * and a function's return value overrides the caller.
 * @internal
 */
export function mergeFactoryOptions (options: FactoryOptions, opts: Record<string, any>) {
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

/** @internal */
export function createAsyncDataMutation<ResT, InputT, NuxtErrorDataT, DataT, DefaultT> (
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
        const value = opts.transform ? await opts.transform(result) : result
        if (current !== promise) {
          return current
        }
        data.value = value as DataT
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
  <ResT, InputT = void, NuxtErrorDataT = unknown, DataT = FactoryDataT<FDataT, ResT>, DefaultT = FactoryDefaultT<FDefaultT, undefined>>(
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
    ? applyMutationAddons<UseAsyncDataMutation>(_createUseAsyncDataMutation, options)
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
