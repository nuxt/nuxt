import { defineNitroPlugin } from 'nitro/runtime'

export default defineNitroPlugin((nitroApp) => {
  if (!import.meta.dev) { return }
  nitroApp.hooks.hook('error', (error) => {
    // TODO: somehow add error logging assertion to @nuxt/test-utils
    if (error.message?.includes('Cannot set headers after they are sent to the client')) {
      process.exit(1)
    }
  })
})
