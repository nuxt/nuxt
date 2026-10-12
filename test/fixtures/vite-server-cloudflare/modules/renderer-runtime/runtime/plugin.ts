import type { RendererPlugin } from 'nuxt/server'

export default (({ hooks }) => {
  hooks.hook('render:html', (html) => {
    html.head.push(`<meta name="renderer-runtime" content="${navigator.userAgent}">`)
  })
}) satisfies RendererPlugin
