import { createError as createH3Error } from '@nuxt/nitro-server/h3'
import type { NuxtErrorJSON } from './types'

export const NUXT_ERROR_SIGNATURE = '__nuxt_error' as const

/**
 * The members are declared here rather than inherited from h3's `H3Error`, but
 * must stay structurally compatible with it: that is what h3 and Nitro read off
 * errors thrown during SSR.
 */
export interface NuxtError<DataT = unknown> extends Error {
  readonly __nuxt_error?: true
  error?: true
  /** Whether the error is fatal. */
  fatal: boolean
  /** Whether the error was not handled by the application. */
  unhandled: boolean
  /** Additional data attached to the error JSON body under `data`. */
  data?: DataT
  status?: number
  statusText?: string
  /** @deprecated Use `status` */
  statusCode?: number
  /** @deprecated Use `statusText` */
  statusMessage?: string
  toJSON (): NuxtErrorJSON<DataT>
}

/**
 * Details accepted when constructing a {@link NuxtError}, as `createError()` reads them.
 *
 * @since 5.0.0
 */
export type NuxtErrorDetails<DataT = unknown> = Partial<NuxtError<DataT>>

/** @since 3.0.0 */
export const isNuxtError = <DataT = unknown>(
  error: unknown,
): error is NuxtError<DataT> => !!error && typeof error === 'object' && NUXT_ERROR_SIGNATURE in error

/** @since 3.0.0 */
export const createError = <DataT = unknown>(error: string | Error | Partial<NuxtError<DataT>>): NuxtError<DataT> => {
  if (isNuxtError<DataT>(error)) { return error }

  if (typeof error !== 'string' && (error as Partial<NuxtError<DataT>>).statusText) {
    error.message ??= (error as Partial<NuxtError<DataT>>).statusText
  }

  const nuxtError: NuxtError<DataT> = createH3Error<DataT>(error)

  Object.defineProperty(nuxtError, NUXT_ERROR_SIGNATURE, {
    value: true,
    configurable: false,
    writable: false,
  })

  // #34165 - TODO: remove in Nuxt 5 when statusCode/statusMessage are removed
  Object.defineProperty(nuxtError, 'status', {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    get: () => nuxtError.statusCode,
    configurable: true,
  })
  Object.defineProperty(nuxtError, 'statusText', {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    get: () => nuxtError.statusMessage,
    configurable: true,
  })

  return nuxtError
}
