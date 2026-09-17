import { definePlugin } from 'nitro'
import { useErrorChannel } from '../utils/error-channel'

/**
 * Silences h3's own `console.error`, since the error handler renders unhandled errors
 * itself in development, and opens the channel so it is listening for reports before
 * anything requests a page.
 */
export default definePlugin((nitroApp) => {
  const h3 = nitroApp.h3 as { config: { silent?: boolean } } | undefined
  if (h3) {
    h3.config.silent = true
  }
  useErrorChannel().catch(() => {})
})
