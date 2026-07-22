import type { FetchOptions } from 'ofetch'
import { toArray } from '../utils'
import type { ArrayItems, UnionToIntersection } from '../utils'
import type { AsyncDataMiddleware, AsyncDataOptions, _AsyncData } from './asyncData'
import type { UseFetchOptions } from './fetch'

declare const AddonOptionsMarker: unique symbol
declare const AddonMarker: unique symbol

type SerializableValue = string | number | boolean | null | undefined | SerializableValue[] | { [key: string]: SerializableValue }

type AsyncDataAddonInstance = _AsyncData<unknown, unknown>

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
    : UnionToIntersection<Addons[number] extends { [AddonMarker]?: { options: any, extension: infer E } } ? E : never>

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

export function attachAddonExtensions (setups: ReadonlyArray<AsyncDataAddonSetup<any>>, instance: object): void {
  for (const setup of setups) {
    const extension = setup(instance as AsyncDataAddonInstance)
    if (extension && typeof extension === 'object') {
      Object.assign(instance, extension)
    }
  }
}
