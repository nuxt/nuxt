import type { H3Error } from '@nuxt/nitro-server/h3'
import { createError as createH3Error } from '@nuxt/nitro-server/h3'
import { toRef } from 'vue'
import type { Ref } from 'vue'
import { useNuxtApp } from '../nuxt'
import type { NuxtPayload } from '../nuxt'
import { useRouter } from './router'

export const NUXT_ERROR_SIGNATURE = '__nuxt_error'

/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
export const useError = (): Ref<NuxtPayload['error']> => toRef(useNuxtApp().payload, 'error')

// #34138 - `Omit` breaks the Error inheritance chain for `@typescript-eslint/only-throw-error`
// TODO: remove in Nuxt 5 when `NuxtError` no longer needs the `Omit` compatibility shape
// Keep a class type here so `createError()` stays throwable while `createH3Error()` remains the runtime source of truth.
export class NuxtError<DataT = unknown> extends Error {
  declare [NUXT_ERROR_SIGNATURE]: true
  declare error?: true
  declare data?: DataT
  declare fatal?: boolean
  declare unhandled?: boolean
  declare status?: number
  declare statusText?: string
  /** @deprecated Use `status` */
  declare statusCode?: H3Error<DataT>['statusCode']
  /** @deprecated Use `statusText` */
  declare statusMessage?: H3Error<DataT>['statusMessage']
}

/** @since 3.0.0 */
export const showError = <DataT = unknown>(
  error: string | Error | (Partial<NuxtError<DataT>> & {
    status?: number
    statusText?: string
  }),
): NuxtError<DataT> => {
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

  error.value = undefined
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

  const nuxtError = createH3Error<DataT>(error) as NuxtError<DataT>

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
