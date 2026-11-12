import type { RendererPlugin, RequestEvent } from 'nuxt/server'

export default (({ hooks }) => {
  hooks.hook('render:document', (document) => {
    const seen = document.html.includes('<meta name="renderer-plugin">')
    document.html = document.html.replace('</head>', `<meta name="renderer-document" content="${seen}"></head>`)
  })

  hooks.hook('render:html', (html, { event }) => {
    html.head.push('<meta name="renderer-plugin">')
    const { res } = event as unknown as RequestEvent
    res.headers.set('x-renderer-plugin', 'true')
  })
}) satisfies RendererPlugin
