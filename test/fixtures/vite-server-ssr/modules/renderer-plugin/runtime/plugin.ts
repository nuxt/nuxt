import type { RendererPlugin } from 'nuxt/server'

export default (({ hooks }) => {
  hooks.hook('render:html', (html) => {
    html.head.push('<meta name="renderer-plugin">')
  })
}) satisfies RendererPlugin
