import { createError as createH3Error } from '@nuxt/nitro-server/h3'
import { toRef } from 'vue'
import type { Ref } from 'vue'
import { useNuxtApp } from '../nuxt'
import type { NuxtApp, NuxtPayload } from '../nuxt'
import type { NuxtErrorJSON } from '../types'
import { isBotUserAgent } from '../utils'
import { useRouter } from './router'
import { appDiagnostics } from '../diagnostics/core'

export const NUXT_ERROR_SIGNATURE = '__nuxt_error' as const

/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
export const useError = (): Ref<NuxtPayload['error']> => toRef(useNuxtApp().payload, 'error')

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

/**
 * Notify the app of an error caught for a crawler without rendering the error
 * page, so the bot indexes the server-rendered HTML instead (#32137, #35338).
 *
 * @internal
 */
export const _notifyCrawlerError = (nuxtApp: NuxtApp, error: Error): Promise<void> | void => {
  const result = nuxtApp.callHook('app:error', createError(error))
  appDiagnostics.NUXT_E1012({ userAgent: navigator.userAgent, cause: error })
  return result
}

/**
 * Show the error page unless the current client is a crawler, in which case the
 * bot receives the already server-rendered HTML instead (#32137, #35338).
 *
 * @internal
 */
export const _showErrorUnlessCrawler = async (nuxtApp: NuxtApp, error: Error): Promise<void> => {
  if (import.meta.client && isBotUserAgent(navigator.userAgent)) {
    await _notifyCrawlerError(nuxtApp, error)
    return
  }
  await nuxtApp.runWithContext(() => showError(error))
}

/** @since 3.0.0 */
export const clearError = async (options: { redirect?: string } = {}): Promise<void> => {
  const nuxtApp = useNuxtApp()
  const error = useError()

  nuxtApp.callHook('app:error:cleared', options)

  if (options.redirect) {
    await useRouter().replace(options.redirect)
  }

  error.value = undefined

  if (import.meta.dev && import.meta.client) {
    for (const el of document.querySelectorAll('nuxt-error-overlay')) {
      el.remove()
    }
  }
}

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
