import type { FetchOptions } from 'ofetch'
import { toArray } from '../utils'
import type { ArrayItems, UnionToIntersection } from '../utils'
import { _isAutoKeyNeeded } from './asyncData'
import type { AsyncData, AsyncDataMiddleware, AsyncDataOptions, UseAsyncData, _AsyncData } from './asyncData'
import type { UseFetch, UseFetchOptions } from './fetch'

declare const AddonMarker: unique symbol

type SerializableValue = string | number | boolean | null | undefined | SerializableValue[] | { [key: string]: SerializableValue }

export type AsyncDataAddonInstance = _AsyncData<unknown, unknown>

export type AsyncDataAddonSetup<Ext> = (asyncData: AsyncDataAddonInstance) => Ext | void

interface AddonChains {
  middleware: AsyncDataMiddleware<any>[]
}

export type UseAsyncDataAddonOptions<Opts extends Record<string, any> = {}> =
  Omit<AsyncDataOptions<any, any>, 'transform' | 'middleware'>
  & AddonChains
  & Opts

export type UseFetchAddonOptions<Opts extends Record<string, any> = {}> =
  Omit<UseFetchOptions<any, any>, 'transform' | 'middleware' | 'onRequest' | 'onRequestError' | 'onResponse' | 'onResponseError'>
  & AddonChains
  & {
    onRequest: ArrayItems<FetchOptions['onRequest']>[]
    onRequestError: ArrayItems<FetchOptions['onRequestError']>[]
    onResponse: ArrayItems<FetchOptions['onResponse']>[]
    onResponseError: ArrayItems<FetchOptions['onResponseError']>[]
  }
  & Opts

export interface UseAsyncDataAddon<Opts extends Record<string, any> = {}, Ext = {}> {
  setup: (options: UseAsyncDataAddonOptions<Opts>) => AsyncDataAddonSetup<Ext> | void
  /** @internal */
  [AddonMarker]?: { options: Opts, extension: Ext }
}

export interface UseFetchAddon<Opts extends Record<string, any> = {}, Ext = {}> {
  /** Segment added to the auto-generated key, derived from custom options that affect the response. */
  key?: (options: UseFetchAddonOptions<Opts>) => SerializableValue
  setup: (options: UseFetchAddonOptions<Opts>) => AsyncDataAddonSetup<Ext> | void
  /** @internal */
  [AddonMarker]?: { options: Opts, extension: Ext }
}

/**
 * Define a reusable addon for composables created with `createUseFetch`.
 * @since 4.6.0
 */
export function defineUseFetchAddon<Opts extends Record<string, any> = {}, Ext = {}> (
  addon: UseFetchAddon<Opts, Ext>,
): UseFetchAddon<Opts, Ext> {
  return addon
}

/**
 * Define a reusable addon for composables created with `createUseAsyncData`.
 * @since 4.6.0
 */
export function defineUseAsyncDataAddon<Opts extends Record<string, any> = {}, Ext = {}> (
  addon: UseAsyncDataAddon<Opts, Ext>,
): UseAsyncDataAddon<Opts, Ext> {
  return addon
}

export type MergedAddonsOptions<Addons extends ReadonlyArray<any>> =
  [Addons[number]] extends [never]
    ? {}
    : UnionToIntersection<Addons[number] extends { [AddonMarker]?: { options: infer O, extension: any } } ? O : never>

export type MergedAddonsExtensions<Addons extends ReadonlyArray<any>> =
  [Addons[number]] extends [never]
    ? {}
    : Omit<UnionToIntersection<Addons[number] extends { [AddonMarker]?: { options: any, extension: infer E } } ? E : never>, PromiseMethod>

type AnyAddon = {
  setup: (options: any) => AsyncDataAddonSetup<any> | void
  key?: (options: any) => SerializableValue
}

const FETCH_HOOK_ARRAY_KEYS = ['onRequest', 'onRequestError', 'onResponse', 'onResponseError'] as const
const PROMISE_METHODS = ['then', 'catch', 'finally'] as const
type PromiseMethod = typeof PROMISE_METHODS[number]

function runAddonSetups (addons: ReadonlyArray<AnyAddon>, options: Record<string, any>, arrayHookKeys: readonly string[]) {
  for (const key of arrayHookKeys) {
    options[key] = options[key] === undefined ? [] : [...toArray(options[key])]
  }

  let setups: AsyncDataAddonSetup<any>[] | undefined
  let keyed: Array<Required<Pick<AnyAddon, 'key'>>> | undefined
  for (const addon of new Set(addons)) {
    if (addon.key) {
      (keyed ??= []).push(addon as Required<Pick<AnyAddon, 'key'>>)
    }
    const result = addon.setup(options)
    if (typeof result === 'function') {
      (setups ??= []).push(result)
    }
  }

  return { setups, keyed }
}

type PromiseMethodNext = (...args: unknown[]) => Promise<unknown>
type PromiseMethodWrapper = (next: PromiseMethodNext, ...args: unknown[]) => Promise<unknown>

// `await` only calls `then` on a promise whose constructor is not %Promise%
class WrappedAsyncDataPromise<T> extends Promise<T> {}

function wrapPromiseMethod (base: PromiseMethodNext, wrappers: PromiseMethodWrapper[] | undefined) {
  let wrapped = base
  for (let i = (wrappers?.length ?? 0) - 1; i >= 0; i--) {
    const wrapper = wrappers![i]!
    const next = wrapped
    wrapped = (...args) => wrapper(next, ...args)
  }
  return wrapped
}

function attachAddonExtensions (setups: ReadonlyArray<AsyncDataAddonSetup<any>>, result: AsyncData<unknown, unknown>) {
  let extensions: Record<string, unknown> | undefined
  let wrappers: Partial<Record<PromiseMethod, PromiseMethodWrapper[]>> | undefined
  for (const setup of setups) {
    const extension = setup(result)
    if (extension && typeof extension === 'object') {
      const { then, catch: _catch, finally: _finally, ...members } = extension as Record<string, unknown> & Partial<Record<PromiseMethod, unknown>>
      const methodWrappers = { then, catch: _catch, finally: _finally }
      for (const method of PROMISE_METHODS) {
        if (typeof methodWrappers[method] === 'function') {
          ((wrappers ??= {})[method] ??= []).push(methodWrappers[method] as PromiseMethodWrapper)
        }
      }
      Object.assign(extensions ??= {}, members)
    }
  }
  if (extensions) {
    Object.assign(result, extensions)
    result.then(instance => Object.assign(instance, extensions))
  }
  if (!wrappers) {
    return result
  }
  const { then: _then, catch: _catch, finally: _finally, ...members } = result
  const wrapped = WrappedAsyncDataPromise.resolve(result) as unknown as AsyncData<unknown, unknown>
  Object.assign(wrapped, members)
  Object.defineProperties(wrapped, {
    then: { enumerable: true, value: wrapPromiseMethod(Promise.prototype.then.bind(wrapped) as PromiseMethodNext, wrappers.then) },
    catch: { enumerable: true, value: wrapPromiseMethod(Promise.prototype.catch.bind(wrapped) as PromiseMethodNext, wrappers.catch) },
    finally: { enumerable: true, value: wrapPromiseMethod(Promise.prototype.finally.bind(wrapped) as PromiseMethodNext, wrappers.finally) },
  })
  return wrapped
}

/** @internal */
export function applyUseFetchAddons (
  create: (options: Record<string, any>) => (...args: any[]) => AsyncData<unknown, unknown>,
  { addons, ...factoryOptions }: Record<string, any>,
): UseFetch {
  const useFetch = create(factoryOptions)
  return ((request: unknown, arg1?: unknown, arg2?: unknown) => {
    const [opts = {}, autoKey] = typeof arg1 === 'string' ? [{}, arg1] : [arg1 as Record<string, any>, arg2]
    const merged: Record<string, any> = { ...factoryOptions, ...opts }
    const { setups, keyed } = runAddonSetups(addons, merged, ['middleware', ...FETCH_HOOK_ARRAY_KEYS])
    if (keyed) {
      merged._keySegments = keyed.map(addon => () => addon.key(merged))
    }
    const result = useFetch(request, merged, autoKey)
    return setups ? attachAddonExtensions(setups, result) : result
  }) as UseFetch
}

/** @internal */
export function applyUseAsyncDataAddons (
  create: (options: Record<string, any>) => (...args: any[]) => AsyncData<unknown, unknown>,
  { addons, ...factoryOptions }: Record<string, any>,
): UseAsyncData {
  const useAsyncData = create(factoryOptions)
  return ((...args: any[]) => {
    const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
    if (_isAutoKeyNeeded(args[0], args[1])) { args.unshift(autoKey) }
    const [key, handler, opts = {}] = args as [unknown, unknown, Record<string, any>]
    const merged: Record<string, any> = { ...factoryOptions, ...opts }
    const { setups } = runAddonSetups(addons, merged, ['middleware'])
    const result = useAsyncData(key, handler, merged)
    return setups ? attachAddonExtensions(setups, result) : result
  }) as UseAsyncData
}
