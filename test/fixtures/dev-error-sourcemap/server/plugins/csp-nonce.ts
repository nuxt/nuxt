import { definePlugin } from 'nitro'
import { useServerHooks } from 'nuxt/server'

// stamps a per-request nonce in `render:html`, as an app with a strict CSP would (#37120)
export default definePlugin(() => {
  useServerHooks().hook('render:html', (html, { event }) => {
    if (event.req.headers.get('x-nonce-hook') !== 'yes') {
      return
    }
    html.bodyAppend = html.bodyAppend.map(chunk => chunk.replaceAll('<script>', '<script nonce="fromhook">'))
  })
})
