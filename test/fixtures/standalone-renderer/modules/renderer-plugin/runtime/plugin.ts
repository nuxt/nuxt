import type { RendererPlugin } from 'nuxt/server'

export default (({ hooks }) => {
  const state = globalThis as { __rendererPluginCalls?: number }
  state.__rendererPluginCalls = (state.__rendererPluginCalls || 0) + 1

  hooks.hook('render:html', async (html) => {
    await Promise.resolve()
    html.head.push('<meta name="renderer-plugin">')
  })
  hooks.hook('render:html:close', (close) => {
    close.bodyAppend.push('<!--renderer-plugin-close-->')
  })
}) satisfies RendererPlugin
