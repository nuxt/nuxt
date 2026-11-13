export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    setResponseHeader(event, 'x-hmr-plugin', 'v1')
  })
})
