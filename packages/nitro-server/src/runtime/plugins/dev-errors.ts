import { definePlugin } from 'nitro'
import { useErrorChannel } from '../utils/error-channel'

/**
 * Silences h3's own `console.error` for unhandled errors, which the error
 * handler renders itself in development, and opens the error channel eagerly
 * so it is listening for reports from the rest of the dev server.
 */
export default definePlugin((nitroApp) => {
  const h3 = nitroApp.h3 as { config: { silent?: boolean } } | undefined
  if (h3) {
    h3.config.silent = true
  }
  useErrorChannel().catch(() => {})
})
