/** Holds the active instance for a given context key. */
export interface NuxtAppContext<T> {
  /** Return the active instance, throwing when none is set. */
  use: () => T
  tryUse: () => T | null
  set: (instance?: T, replace?: boolean) => void
  unset: () => void
  call: <R> (instance: T, callback: () => R) => R
  callAsync: <R> (instance: T, callback: () => R | Promise<R>) => Promise<R>
}
