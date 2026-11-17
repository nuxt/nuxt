import type { RendererPlugin } from 'nuxt/server'
import { useRuntimeConfig } from 'nuxt/server'

export default (({ hooks }) => {
  hooks.hook('render:html', (html, { event }) => {
    html.head.push(`<meta name="renderer-plugin" content="${import.meta.prerender ? 'prerender' : 'request'} ${event.url.pathname}">`)
    html.head.push(`<meta name="renderer-plugin-config" content="${useRuntimeConfig().public.greeting}">`)
    html.bodyAttrs.push('data-renderer-plugin')
  })

  hooks.hook('render:document', (document) => {
    document.html = document.html.replace(/<\/body>/i, '<!-- renderer-document --></body>')
  })
}) satisfies RendererPlugin
