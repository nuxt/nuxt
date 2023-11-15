export default defineNitroPlugin((nitroApp) => {
  if (!import.meta.dev) { return }

  const onError = nitroApp.h3App.options.onError!
  nitroApp.h3App.options.onError = (error, event) => {
    // TODO: somehow add error logging assertion to @nuxt/test-utils
    if (error.message?.includes('Cannot set headers after they are sent to the client')) {
      process.exit(1)
    }
    return onError(error, event)
  }
})
