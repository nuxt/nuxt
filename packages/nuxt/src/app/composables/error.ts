import { HTTPError } from 'h3'
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

export class NuxtError<DataT = unknown> extends HTTPError<DataT> {
  readonly [NUXT_ERROR_SIGNATURE] = true
  readonly fatal: boolean

  constructor (message = '', opts: Partial<NuxtError<DataT>> = {}) {
    super(message, opts)
    this.fatal = opts.fatal ?? !!opts.unhandled
  }
}

/** @since 3.0.0 */
export const createError = <DataT = unknown>(error: string | Error | Partial<NuxtError<DataT>>) => {
  return typeof error === 'string'
    ? new NuxtError<DataT>(error)
    : new NuxtError<DataT>(error.message, error)
}
