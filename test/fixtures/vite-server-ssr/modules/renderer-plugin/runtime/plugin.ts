import type { RendererPlugin } from 'nuxt/server'
import { getRouteRules } from 'nuxt/server'
// @ts-expect-error virtual module provided by the module
import { mark } from '#renderer-plugin/template'

export default (({ hooks }) => {
  hooks.hook('render:document', (document) => {
    const seen = document.html.includes('<meta name="renderer-plugin">')
    document.html = document.html.replace('</head>', `<meta name="renderer-document" content="${seen}"></head>`)
  })

  hooks.hook('render:html', (html, { event }) => {
    const rules = getRouteRules(event)
    html.head.push('<meta name="renderer-plugin">')
    html.head.push(`<meta name="server-template" content="${mark}">`)
    html.head.push(`<meta name="route-rule-scope" content="${rules.rendererPlugin?.scope || ''}">`)
    html.head.push(`<meta name="route-rule-label" content="${rules.rendererPlugin?.label || ''}">`)
    event.res.headers.set('x-renderer-plugin', 'true')
  })
}) satisfies RendererPlugin
