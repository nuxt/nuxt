import { shallowRef, toRef } from 'vue'
import type { AppConfig, ComponentPublicInstance, Ref } from 'vue'
import { useNuxtApp } from '../nuxt'
import type { NuxtApp, NuxtPayload } from '../nuxt'
import { isBotUserAgent } from '../utils'
import { useRouter } from './router'
import { appDiagnostics } from '../diagnostics/core'
import { callAppErrorHook } from '../internal/error-hook'
import { NUXT_ERROR_SIGNATURE, NuxtError, THROWN_CONTEXT, THROWN_VALUE, createError, createErrorFromThrown, isNuxtError, isUntrustedError } from '../error'
import type { NuxtErrorDetails } from '../error'

export { NUXT_ERROR_SIGNATURE, NuxtError, THROWN_CONTEXT, THROWN_VALUE, createError, createErrorFromThrown, isNuxtError, isUntrustedError }
export type { ThrownContext } from '../error'
export type { NuxtErrorDetails }

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
      callAppErrorHook(nuxtApp, nuxtError)
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
  const result = callAppErrorHook(nuxtApp, createErrorFromThrown(error))
  appDiagnostics.NUXT_E1012({ userAgent: navigator.userAgent, cause: error })
  return result
}

/**
 * Call a user-provided `app.config.errorHandler` for an error stopped by an
 * `onErrorCaptured` hook, which prevents Vue from invoking it (#22691).
 *
 * @internal
 */
export const _invokeAppErrorHandler = (nuxtApp: NuxtApp, err: unknown, target: ComponentPublicInstance | null, info: string): void => {
  const errorHandler = nuxtApp.vueApp.config.errorHandler as (AppConfig['errorHandler'] & { __nuxt_default?: boolean }) | undefined
  if (errorHandler && !errorHandler.__nuxt_default) {
    try {
      errorHandler(err, target, info)
    } catch (handlerError) {
      console.error('[nuxt] Error in `app.config.errorHandler`', handlerError)
    }
  }
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
  await nuxtApp.runWithContext(() => showError(createErrorFromThrown(error)))
}

/** @since 3.0.0 */
export const clearError = async (options: { redirect?: string } = {}): Promise<void> => {
  const nuxtApp = useNuxtApp()
  const error = useError()

  nuxtApp.callHook('app:error:cleared', options)?.catch(hookError => console.error('[nuxt] Error in `app:error:cleared` hook', hookError))

  // `<NuxtRoot>` keeps rendering the held error until the redirect settles, so the
  // route that failed is not re-mounted while middleware for the target runs.
  const heldError = import.meta.client && options.redirect ? (nuxtApp['~heldError'] ||= shallowRef()) : undefined
  const redirect = {}
  if (heldError) {
    heldError.value = error.value || heldError.value
    error.value = undefined
    nuxtApp['~heldErrorRedirect'] = redirect
  }

  try {
    if (options.redirect) {
      await useRouter().replace(options.redirect)
    }
  } finally {
    if (!heldError) {
      error.value = undefined
    } else if (nuxtApp['~heldErrorRedirect'] === redirect) {
      heldError.value = undefined
    }

    if (import.meta.dev && import.meta.client) {
      for (const el of document.querySelectorAll('nuxt-error-overlay')) {
        el.remove()
      }
    }
  }
}
