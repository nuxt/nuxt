import { createLog } from '../../../shared/src/log.ts'
import type { Diagnostic } from '../../../shared/src/log.ts'
import * as errorCodes from './error-codes'
import { tryUseNuxtApp } from './nuxt'

export type { CreateLogOptions, Diagnostic, EmitContext, Log } from '../../../shared/src/log.ts'
export { createLog, interpolate, resolve } from '../../../shared/src/log.ts'

export const nuxtRuntimeLog = createLog({
  prefix: 'NUXT',
  verbose: false,
  docs: code => `https://nuxt.com/e/${code}`,
  // TODO: make it tree-shakable
  errors: errorCodes,
  onEmit (diag: Diagnostic) {
    if (import.meta.client) {
      // Browser: print for the user via console
      const parts = [`[NUXT_${diag.code}]`]
      if (diag.message) { parts.push(diag.message) }
      if (diag.fix) { parts.push(diag.fix) }
      if (diag.url) { parts.push(`See: ${diag.url}`) }
      console.warn(parts.join(' '))
    }
    if (import.meta.server) {
      // SSR: do NOT use console (would get intercepted by dev:ssr-logs)
      // Explicitly forward structured Diagnostic object to server
      const nuxtApp = tryUseNuxtApp()
      if (nuxtApp?.ssrContext) {
        (nuxtApp.ssrContext as any)._diagnostics ??= []
        ;(nuxtApp.ssrContext as any)._diagnostics.push(diag)
      }
    }
  },
})
