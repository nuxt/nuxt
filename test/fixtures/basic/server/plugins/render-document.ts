import { getQuery } from 'h3'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    if ('render-document' in getQuery(event)) {
      html.body.push('<p class="user-marker"></p>')
    }
  })
})
