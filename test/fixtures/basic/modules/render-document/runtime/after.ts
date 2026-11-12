import type { RendererPlugin } from 'nuxt/server'

export default (({ hooks }) => {
  hooks.hook('render:html', (html, { event }) => {
    if (event.path.includes('render-document')) {
      html.body.push('<p class="after-marker"></p>')
    }
  })
}) satisfies RendererPlugin
