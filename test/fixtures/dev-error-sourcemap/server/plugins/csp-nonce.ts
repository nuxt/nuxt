import { definePlugin } from 'nitro'
import { useServerHooks } from 'nuxt/server'

export default definePlugin(() => {
  useServerHooks().hook('render:html', (html, { event }) => {
    if (event.req.headers.get('x-nonce-hook') !== 'yes') {
      return
    }
    const stamp = (chunk: string) => chunk.replaceAll('<script>', '<script nonce="fromhook">')
    html.bodyPrepend = html.bodyPrepend.map(stamp)
    html.bodyAppend = html.bodyAppend.map(stamp)
  })
})
