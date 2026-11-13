import type { NuxtServerApp } from '../types'

/**
 * Call the `app:error` hook, logging a rejection rather than letting it replace the error
 * being reported.
 */
export function callAppErrorHook (nuxtApp: Pick<NuxtServerApp, 'hooks'> | undefined, error: unknown): Promise<void> | void {
  return nuxtApp?.hooks.callHook('app:error', error)?.catch((hookError: unknown) => console.error('[nuxt] Error in `app:error` hook', hookError))
}
