import type { RendererPlugin } from 'nuxt/server'

export default (({ hooks }) => {
  const state = globalThis as { __rendererPluginCalls?: number }
  state.__rendererPluginCalls = (state.__rendererPluginCalls || 0) + 1

  hooks.hook('render:html', (html) => {
    html.head.push('<meta name="renderer-plugin">')
  })
}) satisfies RendererPlugin
