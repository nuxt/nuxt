import type { KeysOf } from '../composables/asyncData'
import type { NuxtError } from '../composables/error'

/** The error type for a data type parameter: an `Error` is kept as is, anything else becomes the `data` of a `NuxtError`. */
export type NuxtErrorFor<NuxtErrorDataT> = NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>

/** The data type a factory sets, or the call's own when the factory leaves it unset. */
export type FactoryDataT<FDataT, ResT> = [unknown] extends [FDataT] ? ResT : FDataT

/** The default type a factory sets, or `Fallback` when the factory leaves it unset. */
export type FactoryDefaultT<FDefaultT, Fallback> = [undefined] extends [FDefaultT] ? Fallback : FDefaultT

/** The keys a factory picks, or the call's own when the factory picks none. */
export type FactoryPickKeys<FPickKeys, PickKeys, DataT> = [Array<never>] extends [FPickKeys] ? PickKeys : FPickKeys & KeysOf<DataT>
