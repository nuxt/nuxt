import { definePlugin } from 'nitro'
import { useServerHooks } from 'nuxt/server'

export default definePlugin(() => {
  useServerHooks().hook('render:html', (html) => {
    html.head.push('<meta name="server-hooks" content="ok">')
  })
})
