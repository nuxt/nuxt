import type { RendererPlugin } from 'nuxt/server'

export default (({ hooks }) => {
  hooks.hook('render:html', (html, { event }) => {
    html.head.push(`<meta name="renderer-plugin" content="${import.meta.prerender ? 'prerender' : 'request'} ${event.url.pathname}">`)
    html.bodyAttrs.push('data-renderer-plugin')
  })
}) satisfies RendererPlugin
