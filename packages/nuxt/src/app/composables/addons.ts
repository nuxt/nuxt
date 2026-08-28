import type { FetchOptions } from 'ofetch'
import { toArray } from '../utils'
import type { ArrayItems, UnionToIntersection } from '../utils'
import type { AsyncDataMiddleware, AsyncDataOptions, _AsyncData } from './asyncData'
import type { UseFetchOptions } from './fetch'

declare const AddonOptionsMarker: unique symbol
declare const AddonMarker: unique symbol

type SerializableValue = string | number | boolean | null | undefined | SerializableValue[] | { [key: string]: SerializableValue }

export type AsyncDataAddonInstance = _AsyncData<unknown, unknown>

export type AsyncDataAddonSetup<Ext> = (asyncData: AsyncDataAddonInstance) => Ext | void

interface AddonChains {
  /**
   * AsyncData middleware wrapping the handler execution.
   * Middleware is executed in the order of the array, with the first entry being the outermost wrapper.
   *
   * Call `next()` to continue the chain, or throw an error to abort.
   */
  middleware: AsyncDataMiddleware<any>[]
}

export type UseAsyncDataAddonOptions<Opts extends Record<string, any> = {}> =
  Omit<AsyncDataOptions<any, any>, 'transform' | 'middleware'>
  & AddonChains
  & Opts
  & {
    /** @internal */
    [AddonOptionsMarker]?: Opts
  }

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
  & {
    /** @internal */
    [AddonOptionsMarker]?: Opts
  }

export interface UseAsyncDataAddon<Opts extends Record<string, any> = {}, Ext = {}> {
  setup: (options: UseAsyncDataAddonOptions<Opts>) => AsyncDataAddonSetup<Ext> | void
  /** @internal */
  [AddonMarker]?: { options: Opts, extension: Ext }
}

export interface UseFetchAddon<Opts extends Record<string, any> = {}, Ext = {}> {
  /**
   * Resolves this addon's contribution to the auto-generated key. Return a value derived
   * from the custom options that affect the response, so that calls with different values
   * do not share a cached entry. Return `undefined` to contribute nothing.
   */
  key?: (options: UseFetchAddonOptions<Opts>) => SerializableValue
  setup: (options: UseFetchAddonOptions<Opts>) => AsyncDataAddonSetup<Ext> | void
  /** @internal */
  [AddonMarker]?: { options: Opts, extension: Ext }
}

/**
 * Define a `useFetch` addon: a typed unit of behavior that can add custom options,
 * participate in the request lifecycle and augment the return value of composables
 * created with `createUseFetch`.
 *
 * @example Declare custom options as a plain type on the setup parameter annotation
 * defineUseFetchAddon({ setup: (options: UseFetchAddonOptions<{ auth?: boolean }>) => { ... } })
 *
 * @since 4.6.0
 */
export function defineUseFetchAddon<Opts extends Record<string, any> = {}, Ext = {}> (
  addon: UseFetchAddon<Opts, Ext>,
): UseFetchAddon<Opts, Ext> {
  return addon
}

/**
 * Define a `useAsyncData` addon
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
    // promise-method wrappers are runtime behavior, not part of the instance surface
    : Omit<UnionToIntersection<Addons[number] extends { [AddonMarker]?: { options: any, extension: infer E } } ? E : never>, PromiseMethod>

type AnyAddon = {
  setup: (options: any) => AsyncDataAddonSetup<any> | void
  key?: (options: any) => SerializableValue
}

export function runAddonSetups (
  addons: ReadonlyArray<AnyAddon>,
  options: Record<string, any>,
  arrayHookKeys?: readonly string[],
): {
  setups?: AsyncDataAddonSetup<any>[]
  keyed?: Array<Required<Pick<AnyAddon, 'key'>>>
} {
  options.middleware = options.middleware === undefined ? [] : toArray(options.middleware)
  if (arrayHookKeys) {
    for (const key of arrayHookKeys) {
      options[key] = options[key] === undefined ? [] : toArray(options[key])
    }
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

const PROMISE_METHODS = ['then', 'catch', 'finally'] as const
type PromiseMethod = typeof PROMISE_METHODS[number]

export type AddonPromiseWrappers = Partial<Record<PromiseMethod, PromiseMethodWrapper[]>>

export function attachAddonExtensions (setups: ReadonlyArray<AsyncDataAddonSetup<unknown>>, instance: object): AddonPromiseWrappers | undefined {
  let wrappers: AddonPromiseWrappers | undefined
  for (const setup of setups) {
    const extension = setup(instance as AsyncDataAddonInstance)
    if (extension && typeof extension === 'object') {
      for (const method of PROMISE_METHODS) {
        const wrapper = (extension as Record<string, unknown>)[method]
        if (typeof wrapper === 'function') {
          ((wrappers ??= {})[method] ??= []).push(wrapper as PromiseMethodWrapper)
          // promise-method wrappers apply to the awaitable promise, not the instance itself
          delete (extension as Record<string, unknown>)[method]
        }
      }
      Object.assign(instance, extension)
    }
  }
  return wrappers
}

export function wrapPromiseMethod<T extends (...args: never[]) => Promise<unknown>> (base: T, wrappers: PromiseMethodWrapper[] | undefined): T {
  if (!wrappers?.length) {
    return base
  }
  let wrapped = base as unknown as PromiseMethodNext
  // compose right-to-left so the first addon's wrapper is outermost, like middleware
  for (let i = wrappers.length - 1; i >= 0; i--) {
    const wrapper = wrappers[i]!
    const next = wrapped
    wrapped = (...args) => wrapper(next, ...args)
  }
  return wrapped as unknown as T
}
