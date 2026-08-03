import { toRef } from 'vue'
import type { HTTPError } from '@nuxt/nitro-server/h3'
import type { Ref } from 'vue'
import { useNuxtApp } from '../nuxt'
import type { NuxtApp, NuxtPayload } from '../nuxt'
import type { NuxtError as _NuxtErrorContract } from '../types'
import { isBotUserAgent } from '../utils'
import { sanitizeStatusCode, sanitizeStatusMessage } from '../utils/http-status'
import { useRouter } from './router'
import { appDiagnostics } from '../diagnostics/core'

export const NUXT_ERROR_SIGNATURE = '__nuxt_error' as const

/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
export const useError = (): Ref<NuxtPayload['error']> => toRef(useNuxtApp().payload, 'error')

/** @since 3.0.0 */
export const showError = <DataT = unknown>(
  error: string | Error | NuxtErrorDetails<DataT>,
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
export const isNuxtError = <DataT = unknown>(error: unknown): error is NuxtError<DataT> => {
  return !!error && typeof error === 'object' && NUXT_ERROR_SIGNATURE in error
}

/**
 * Details accepted when constructing a {@link NuxtError}.
 *
 * @since 5.0.0
 */
export type NuxtErrorDetails<DataT = unknown> = Partial<Omit<NuxtError<DataT>, 'headers' | 'name' | 'toJSON'>> & {
  /** @deprecated use `status` */
  statusCode?: number
  /** @deprecated use `statusText` */
  statusMessage?: string
  headers?: HeadersInit
}

export class NuxtError<DataT = unknown> extends Error implements _NuxtErrorContract<DataT> {
  readonly [NUXT_ERROR_SIGNATURE] = true as const

  /**
   * h3 recognises its own errors by constructor name rather than `instanceof`,
   * so errors thrown during SSR are only mapped to the right HTTP response if
   * `name` stays `HTTPError`.
   */
  override get name (): string {
    return 'HTTPError'
  }

  /** HTTP status code in range [100...599] */
  readonly status: number
  /** HTTP status text (reason phrase) */
  readonly statusText: string | undefined
  /** Additional HTTP headers to be sent with the error response. */
  readonly headers: Headers | undefined
  /** Additional data attached to the error JSON body under `data`. */
  readonly data: DataT | undefined
  /** Additional top-level properties to attach to the error JSON body. */
  readonly body: Record<string, unknown> | undefined
  /** Whether the error was not handled by the application. */
  readonly unhandled: boolean | undefined
  readonly fatal: boolean
  override readonly cause: unknown

  constructor (message: string | NuxtErrorDetails<DataT> = '', opts: NuxtErrorDetails<DataT> = {}) {
    const details = (typeof message === 'string' ? opts : message) || {}
    const cause = details.cause as NuxtErrorDetails<DataT> | undefined

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const status = sanitizeStatusCode(details.status || details.statusCode || cause?.status || cause?.statusCode, 500)
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const statusText = sanitizeStatusMessage(details.statusText || details.statusMessage || cause?.statusText || cause?.statusMessage)

    super(
      (typeof message === 'string' ? message : '') ||
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      details.message || cause?.message || details.statusText || details.statusMessage ||
      ['HTTPError', status, statusText].filter(Boolean).join(' '),
      { cause: details },
    )

    this.status = status
    this.statusText = statusText || undefined
    const headers = details.headers || cause?.headers
    this.headers = headers ? new Headers(headers) : undefined
    this.unhandled = details.unhandled ?? cause?.unhandled ?? undefined
    this.data = details.data
    this.body = details.body
    this.cause = details instanceof Error ? details : details.cause
    this.fatal = details.fatal ?? !!this.unhandled
  }

  /** @deprecated use `status` */
  get statusCode (): number {
    return this.status
  }

  /** @deprecated use `statusText` */
  get statusMessage (): string | undefined {
    return this.statusText
  }

  toJSON (): ReturnType<HTTPError<DataT>['toJSON']> {
    const unhandled = this.unhandled
    return {
      status: this.status,
      statusText: this.statusText,
      unhandled,
      message: unhandled ? 'HTTPError' : this.message,
      data: unhandled ? undefined : this.data,
      ...unhandled ? undefined : this.body,
    }
  }
}

/** @since 3.0.0 */
export const createError = <DataT = unknown>(error: string | Error | NuxtErrorDetails<DataT>): NuxtError<DataT> => {
  if (isNuxtError<DataT>(error)) { return error }
  return typeof error === 'string'
    ? new NuxtError<DataT>(error)
    : new NuxtError<DataT>(error.message ?? '', error as NuxtErrorDetails<DataT>)
}
