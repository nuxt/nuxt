import { createError as _createError, H3Error } from 'h3'
import { useNuxtApp, useState } from '#app'

export const useError = () => {
  const nuxtApp = useNuxtApp()
  return useState('error', () => process.server ? nuxtApp.ssrContext.error : nuxtApp.payload.error)
}

export interface NuxtError extends H3Error {}

export const showError = (_err: string | Error | Partial<NuxtError>) => {
  const err = createError(_err)

  try {
    const nuxtApp = useNuxtApp()
    nuxtApp.callHook('app:error', err)
    if (process.server) {
      nuxtApp.ssrContext.error = nuxtApp.ssrContext.error || err
    } else {
      const error = useError()
      error.value = error.value || err
    }
  } catch {
    throw err
  }

  return err
}

/** @deprecated Use `throw createError()` or `showError` */
export const throwError = showError

export const clearError = async (options: { redirect?: string } = {}) => {
  const nuxtApp = useNuxtApp()
  const error = useError()
  nuxtApp.callHook('app:error:cleared', options)
  if (options.redirect) {
    await nuxtApp.$router.replace(options.redirect)
  }
  error.value = null
}

export const isNuxtError = (err?: string | object): err is NuxtError => err && typeof err === 'object' && ('__nuxt_error' in err)

export const createError = (err: string | Partial<NuxtError>): NuxtError => {
  const _err: NuxtError = _createError(err)
  ;(_err as any).__nuxt_error = true
  return _err
}
