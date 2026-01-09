import { toRef } from 'vue'
import type { Ref } from 'vue'
import { useNuxtApp } from '../nuxt'
import type { NuxtPayload } from '../nuxt'
import { useRouter } from './router'

export const NUXT_ERROR_SIGNATURE = '__nuxt_error'

/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
export const useError = (): Ref<NuxtPayload['error']> => toRef(useNuxtApp().payload, 'error')

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
export const isNuxtError = <DataT = unknown>(error: unknown): error is NuxtError<DataT> => {
  return !!error && typeof error === 'object' && NUXT_ERROR_SIGNATURE in error
}

export class NuxtError<DataT = unknown> extends Error {
  readonly [NUXT_ERROR_SIGNATURE] = true
  readonly status: number
  readonly statusText: string
  readonly fatal: boolean
  readonly unhandled?: boolean
  readonly data?: DataT
  override readonly cause?: unknown

  /** @deprecated Use `status` instead */
  get statusCode () { return this.status }
  /** @deprecated Use `statusText` instead */
  get statusMessage () { return this.statusText }

  constructor (message = '', opts: Partial<NuxtError<DataT>> = {}) {
    super(message, { cause: opts.cause })
    this.name = 'NuxtError'
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.status = opts.status ?? opts.statusCode ?? 500
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.statusText = opts.statusText ?? opts.statusMessage ?? ''
    this.fatal = opts.fatal ?? !!opts.unhandled
    this.unhandled = opts.unhandled
    this.data = opts.data
  }

  toJSON () {
    return {
      message: this.message,
      status: this.status,
      statusText: this.statusText,
      fatal: this.fatal,
      unhandled: this.unhandled,
      data: this.unhandled ? undefined : this.data,
    }
  }
}

/** @since 3.0.0 */
export const createError = <DataT = unknown>(error: string | Error | Partial<NuxtError<DataT>>) => {
  return typeof error === 'string'
    ? new NuxtError<DataT>(error)
    : new NuxtError<DataT>(error.message, error)
}
