import { definePlugin } from 'nitro'
import { useNitroHooks } from 'nitro/app'

export default definePlugin(() => {
  if (!import.meta.dev) { return }
  useNitroHooks().hook('error', (error) => {
    // TODO: somehow add error logging assertion to @nuxt/test-utils
    if (error.message?.includes('Cannot set headers after they are sent to the client')) {
      process.exit(1)
    }
  })
})
