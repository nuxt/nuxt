import { HTTPError } from '@nuxt/nitro-server/h3'
import { toRef } from 'vue'
import type { Ref } from 'vue'
import { useNuxtApp } from '../nuxt'
import type { NuxtApp, NuxtPayload } from '../nuxt'
import type { NuxtError as _NuxtErrorContract } from '../types'
import { isBotUserAgent } from '../utils'
import { useRouter } from './router'
import { appDiagnostics } from '../diagnostics/core'

export const NUXT_ERROR_SIGNATURE = '__nuxt_error' as const

/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
export const useError = (): Ref<NuxtPayload['error']> => toRef(useNuxtApp().payload, 'error')

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
}

/** @since 3.0.0 */
export const isNuxtError = <DataT = unknown>(error: unknown): error is NuxtError<DataT> => {
  return !!error && typeof error === 'object' && NUXT_ERROR_SIGNATURE in error
}

export class NuxtError<DataT = unknown> extends HTTPError<DataT> implements _NuxtErrorContract<DataT> {
  readonly __nuxt_error = true as const
  readonly fatal: boolean
  override readonly cause: unknown

  constructor (message = '', opts: Partial<NuxtError<DataT>> = {}) {
    super(message, opts)
    this.cause = opts instanceof Error ? opts : opts.cause
    this.fatal = opts.fatal ?? !!opts.unhandled
  }
}

/** @since 3.0.0 */
export const createError = <DataT = unknown>(error: string | Error | Partial<NuxtError<DataT>>): NuxtError<DataT> => {
  if (isNuxtError<DataT>(error)) { return error }
  return typeof error === 'string'
    ? new NuxtError<DataT>(error)
    : new NuxtError<DataT>(error.message, error)
}
