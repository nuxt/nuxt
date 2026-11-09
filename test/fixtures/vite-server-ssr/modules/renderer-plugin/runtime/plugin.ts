import type { RendererPlugin, RequestEvent } from 'nuxt/server'

export default (({ hooks }) => {
  hooks.hook('render:html', (html, { event }) => {
    html.head.push('<meta name="renderer-plugin">')
    const { res } = event as unknown as RequestEvent
    res.headers.set('x-renderer-plugin', 'true')
  })
}) satisfies RendererPlugin
