import type { RendererPlugin } from 'nuxt/server'

export default (({ hooks }) => {
  hooks.hook('render:document', (document, { event }) => {
    if (!event.path.includes('render-document')) { return }
    const seen = ['before', 'after', 'user'].filter(name => document.html.includes(`<p class="${name}-marker">`))
    document.html = document.html.replace('</head>', `<meta name="render-document" content="${seen.join(' ')}"></head>`)
  })
}) satisfies RendererPlugin
