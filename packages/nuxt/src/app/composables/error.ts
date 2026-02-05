import type { H3Error } from 'h3'
import { createError as createH3Error } from 'h3'
import { toRef } from 'vue'
import type { Ref } from 'vue'
import { useNuxtApp } from '../nuxt'
import type { NuxtPayload } from '../nuxt'
import { useRouter } from './router'

// @ts-expect-error virtual file
import { nuxtDefaultErrorValue } from '#build/nuxt.config.mjs'

export const NUXT_ERROR_SIGNATURE = '__nuxt_error'

/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
export const useError = (): Ref<NuxtPayload['error']> => toRef(useNuxtApp().payload, 'error')

// #34138 - `Omit` breaks the Error inheritance chain, causing `@typescript-eslint/only-throw-error` to fail
// Adding `Error` explicitly restores throwability. TODO: remove `Error` in Nuxt 5 when `Omit` is no longer needed
export interface NuxtError<DataT = unknown> extends Omit<H3Error<DataT>, 'statusCode' | 'statusMessage'>, Error {
  error?: true
  status?: number
  statusText?: string
  /** @deprecated Use `status` */
  statusCode?: H3Error<DataT>['statusCode']
  /** @deprecated Use `statusText` */
  statusMessage?: H3Error<DataT>['statusMessage']
}

/** @since 3.0.0 */
export const showError = <DataT = unknown>(
  error: string | Error | (Partial<NuxtError<DataT>> & {
    status?: number
    statusText?: string
  }),
) => {
  const nuxtError = createError<DataT>(error)

  try {
    const error = useError()

    if (import.meta.client) {
      const nuxtApp = useNuxtApp()
      nuxtApp.hooks.callHook('app:error', nuxtError)
    }

    error.value ||= nuxtError
  } catch {
    throw nuxtError
  }

  return nuxtError
}

/** @since 3.0.0 */
export const clearError = async (options: { redirect?: string } = {}) => {
  const nuxtApp = useNuxtApp()
  const error = useError()

  nuxtApp.callHook('app:error:cleared', options)

  if (options.redirect) {
    await useRouter().replace(options.redirect)
  }

  error.value = nuxtDefaultErrorValue
}

/** @since 3.0.0 */
export const isNuxtError = <DataT = unknown>(
  error: unknown,
): error is NuxtError<DataT> => !!error && typeof error === 'object' && NUXT_ERROR_SIGNATURE in error

/** @since 3.0.0 */
export const createError = <DataT = unknown>(error: string | Error | Partial<NuxtError<DataT>>) => {
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
