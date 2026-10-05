import { defineNitroPlugin } from 'nitropack/runtime'
import { useServerHooks } from 'nuxt/server'

export default defineNitroPlugin(() => {
  useServerHooks().hook('render:html', (html) => {
    html.head.push('<meta name="server-hooks" content="ok">')
  })
})
