export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    html.head = html.head.map((headSection: string) => headSection.replace(/<link((?=[^>]+\bhref="\/_nuxt\/DelayedWrapperTestComponent\.([^.]+?)\.js")[^>]+>)/, '')) // .replace(/<link rel="preload" href="\/_nuxt\/DelayedWrapperTestComponent\.js" as="script">/, "")
  })
})
