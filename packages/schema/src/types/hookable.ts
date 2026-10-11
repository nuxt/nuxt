/**
 * Nuxt's hook registry surface, as exposed on `nuxt.hooks` and mirrored by `nuxt.hook()` and
 * `nuxt.callHook()`.
 *
 * The types below describe the contract rather than the implementation, so the underlying hook
 * library can be swapped without changing Nuxt's public API. They are structurally satisfied by
 * `hookable`.
 */

export type NuxtHookCallback = (...args: any) => Promise<void> | void

export type NuxtHookKeys<T> = keyof T & string

export interface NuxtDeprecatedHook<T> {
  message?: string
  to: NuxtHookKeys<T>
}

type ValueOf<T> = T extends Record<any, any> ? T[keyof T] : never
type Strings<T> = Exclude<keyof T, number | symbol>
type KnownKeys<T> = keyof { [K in keyof T as string extends K ? never : number extends K ? never : K]: never }
type StripGeneric<T> = Pick<T, KnownKeys<T> extends keyof T ? KnownKeys<T> : never>
type OnlyGeneric<T> = Omit<T, KnownKeys<T> extends keyof T ? KnownKeys<T> : never>
type Namespaces<T> = ValueOf<{ [K in Strings<T>]: K extends `${infer Namespace}:${string}` ? Namespace : never }>
type BareHooks<T> = ValueOf<{ [K in Strings<T>]: K extends `${string}:${string}` ? never : K }>
type HooksInNamespace<T, Namespace extends string> = ValueOf<{ [K in Strings<T>]: K extends `${Namespace}:${infer HookName}` ? HookName : never }>
type WithoutNamespace<T, Namespace extends string> = { [K in HooksInNamespace<T, Namespace>]: `${Namespace}:${K}` extends keyof T ? T[`${Namespace}:${K}`] : never }

/**
 * Hooks as they may be written in `nuxt.config`, where a namespaced hook such as `build:done`
 * can also be nested under a `build` key.
 */
export type NuxtNestedHooks<T> =
  (Partial<StripGeneric<T>> | Partial<OnlyGeneric<T>>)
  & Partial<{ [K in Namespaces<StripGeneric<T>>]: NuxtNestedHooks<WithoutNamespace<T, K>> }>
  & Partial<{ [K in BareHooks<StripGeneric<T>>]: T[K] }>

type InferCallback<HT, HN extends keyof HT> = HT[HN] extends NuxtHookCallback ? HT[HN] : never

/** A hook call, as observed by `beforeEach` and `afterEach`. */
export type NuxtHookSpyEvent<HT extends Record<string, any>> = {
  [K in keyof HT]: {
    name: K
    args: Parameters<HT[K]>
    context: Record<string, any>
  }
}[keyof HT]

export interface NuxtHookRegistry<HooksT extends Record<string, any>, HookNameT extends NuxtHookKeys<HooksT> = NuxtHookKeys<HooksT>> {
  /** Register a listener for a hook. Returns a function that removes it again. */
  hook: <NameT extends HookNameT>(name: NameT, fn: InferCallback<HooksT, NameT>, options?: { allowDeprecated?: boolean }) => () => void
  /** Register a listener that is removed after it runs once. */
  hookOnce: <NameT extends HookNameT>(name: NameT, fn: InferCallback<HooksT, NameT>) => () => void
  removeHook: <NameT extends HookNameT>(name: NameT, fn: InferCallback<HooksT, NameT>) => void
  /** Remove every listener for a hook. */
  clearHook: <NameT extends HookNameT>(name: NameT) => void
  /** Mark a hook as deprecated in favour of another. */
  deprecateHook: <NameT extends HookNameT>(name: NameT, deprecated: NuxtHookKeys<HooksT> | NuxtDeprecatedHook<HooksT>) => void
  deprecateHooks: (deprecatedHooks: Partial<Record<HookNameT, NuxtDeprecatedHook<HooksT>>>) => void
  /** Register several listeners at once, optionally nested by namespace. */
  addHooks: (configHooks: NuxtNestedHooks<HooksT>) => () => void
  removeHooks: (configHooks: NuxtNestedHooks<HooksT>) => void
  removeAllHooks: () => void
  /** Call every listener for a hook in series. */
  callHook: <NameT extends HookNameT>(name: NameT, ...args: Parameters<InferCallback<HooksT, NameT>>) => Promise<any> | void
  /** Call every listener for a hook in parallel. */
  callHookParallel: <NameT extends HookNameT>(name: NameT, ...args: Parameters<InferCallback<HooksT, NameT>>) => Promise<any[]> | void
  /** Call every listener for a hook through a custom caller. */
  callHookWith: <NameT extends HookNameT, CallFunction extends (hooks: NuxtHookCallback[], args: Parameters<InferCallback<HooksT, NameT>>, name: NameT) => any>(caller: CallFunction, name: NameT, args: Parameters<InferCallback<HooksT, NameT>>) => ReturnType<CallFunction>
  /** Observe every hook call before its listeners run. */
  beforeEach: (fn: (event: NuxtHookSpyEvent<HooksT>) => void) => () => void
  /** Observe every hook call after its listeners have run. */
  afterEach: (fn: (event: NuxtHookSpyEvent<HooksT>) => void) => () => void
}
