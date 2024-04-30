import type { UseScriptInput } from '@unhead/vue'
import { createError } from './error'

function renderStubMessage (name: string) {
  const message = `\`${name}\` is provided by @nuxt/scripts. Check your console to install it or run 'npx nuxi@latest module add @nuxt/scripts' to install it.`
  if (import.meta.client) {
    throw createError({
      fatal: true,
      statusCode: 500,
      statusMessage: message,
    })
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScript<T extends Record<string | symbol, any>> (input: UseScriptInput, options?: Record<string, unknown>) {
  renderStubMessage('useScript')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createScriptConsentTrigger (...args: unknown[]) {
  renderStubMessage('createScriptConsentTrigger')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useAnalyticsPageEvent (...args: unknown[]) {
  renderStubMessage('useAnalyticsPageEvent')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useElementScriptTrigger (...args: unknown[]) {
  renderStubMessage('useElementScriptTrigger')
}
