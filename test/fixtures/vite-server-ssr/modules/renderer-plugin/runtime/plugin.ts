import type { RendererPlugin } from 'nuxt/server'
// @ts-expect-error virtual module provided by the module
import { mark } from '#renderer-plugin/template'

export default (({ hooks }) => {
  hooks.hook('render:document', (document) => {
    const seen = document.html.includes('<meta name="renderer-plugin">')
    document.html = document.html.replace('</head>', `<meta name="renderer-document" content="${seen}"></head>`)
  })

  hooks.hook('render:html', (html, { event }) => {
    html.head.push('<meta name="renderer-plugin">')
    html.head.push(`<meta name="server-template" content="${mark}">`)
    event.res.headers.set('x-renderer-plugin', 'true')
  })
}) satisfies RendererPlugin
