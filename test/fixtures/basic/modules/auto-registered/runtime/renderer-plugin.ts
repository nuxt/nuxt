import type { RendererPlugin } from 'nuxt/server'

export default (({ hooks }) => {
  hooks.hook('render:html', (html, { event }) => {
    html.head.push('<meta name="renderer-plugin">')
    event.res.headers.set('x-renderer-plugin', 'true')
  })
}) satisfies RendererPlugin
