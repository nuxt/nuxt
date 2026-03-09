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

  error.value = undefined
}

/** @since 3.0.0 */
export const isNuxtError = <DataT = unknown>(
  error: unknown,
): error is NuxtError<DataT> => !!error && typeof error === 'object' && NUXT_ERROR_SIGNATURE in error

// Default HTTP status text for common codes (RFC 7231, etc.). Used when statusText/statusMessage is not provided.
const DEFAULT_STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

/** @since 3.0.0 */
export const createError = <DataT = unknown>(error: string | Error | Partial<NuxtError<DataT>>) => {
  if (typeof error !== 'string' && error !== null && typeof error === 'object') {
    const err = error as Partial<NuxtError<DataT>>
    if (err.statusText) {
      err.message ??= err.statusText
    }
    // Auto-generate statusText from status code when not provided (#34280)
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const statusCode = typeof err.status === 'number' ? err.status : err.statusCode
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (typeof statusCode === 'number' && err.statusText === undefined && err.statusMessage === undefined) {
      const defaultText = DEFAULT_STATUS_TEXT[statusCode] ?? 'Error'
      err.statusText = defaultText
      // statusMessage required for h3 createError; Nuxt getter maps statusText -> statusMessage
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      err.statusMessage = defaultText
    }
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
