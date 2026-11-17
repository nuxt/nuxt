export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response) => {
    response.headers ||= {}
    response.headers['x-legacy-plugin'] = 'yes'
  })
})
