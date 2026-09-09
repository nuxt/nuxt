export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html) => {
    html.head.push('<meta name="module-nitro-plugin" content="registered">')
  })
})
