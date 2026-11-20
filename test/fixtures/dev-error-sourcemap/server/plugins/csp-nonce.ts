import { getRequestHeader } from 'h3'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    if (getRequestHeader(event, 'x-nonce-hook') !== 'yes') {
      return
    }
    const stamp = (chunk: string) => chunk.replaceAll('<script>', '<script nonce="fromhook">')
    html.bodyPrepend = html.bodyPrepend.map(stamp)
    html.bodyAppend = html.bodyAppend.map(stamp)
  })
})
