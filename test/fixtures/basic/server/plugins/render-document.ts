import { definePlugin } from 'nitro'
import { useServerHooks } from 'nuxt/server'

export default definePlugin(() => {
  useServerHooks().hook('render:html', (html, { event }) => {
    if (event.url.searchParams.has('render-document')) {
      html.body.push('<p class="user-marker"></p>')
    }
  })
})
