import type { NuxtServerApp } from '../types'

/** Call the `app:error` hook and log any rejection. */
export function callAppErrorHook (nuxtApp: Pick<NuxtServerApp, 'hooks'> | undefined, error: unknown): Promise<void> | void {
  return nuxtApp?.hooks.callHook('app:error', error)?.catch((hookError: unknown) => console.error('[nuxt] Error in `app:error` hook', hookError))
}
