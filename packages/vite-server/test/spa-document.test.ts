import { HookableCore } from 'hookable'
import { describe, expect, it, vi } from 'vitest'

vi.mock('nuxt/internal/renderer/plugins', () => ({
  createRendererPluginHooks: () => {
    const hooks = new HookableCore()
    hooks.hook('render:html', (html: { htmlAttrs: string[], head: string[], bodyAttrs: string[], bodyAppend: string[] }) => {
      html.htmlAttrs.push('data-html')
      html.head.push('<meta name="plugin">')
      html.bodyAttrs.push('data-body')
      html.bodyAppend.push('<!-- appended -->')
    })
    hooks.hook('render:document', (document: { html: string }) => {
      document.html = document.html.replace(/<\/body>/i, '<!-- document -->$&')
    })
    hooks.hook('render:html', (html: { bodyAppend: string[] }) => {
      html.bodyAppend.push('<!-- after -->')
    })
    return hooks
  },
}))

const { default: renderDocument } = await import('../src/runtime/spa-document.ts')

describe('static SPA document', () => {
  it('renders the document through the `render:html` and `render:document` hooks, keeping its attributes', async () => {
    const html = '<!DOCTYPE html><html lang="en"><head prefix="og: https://ogp.me/ns#"><title>app</title></head><body class="spa"><header></header><div id="__nuxt"></div></body></html>'

    expect(await renderDocument(html, 'http://localhost/')).toBe(
      '<!DOCTYPE html><html lang="en" data-html><head prefix="og: https://ogp.me/ns#"><title>app</title><meta name="plugin"></head><body class="spa" data-body><header></header><div id="__nuxt"></div><!-- appended --><!-- after --><!-- document --></body></html>',
    )
  })

  it('matches document tags regardless of case', async () => {
    const html = '<!DOCTYPE html><HTML><HEAD><title>app</title></HEAD><BODY><div id="__nuxt"></div></BODY></HTML>'

    expect(await renderDocument(html, 'http://localhost/')).toBe(
      '<!DOCTYPE html><html data-html><head><title>app</title><meta name="plugin"></head><body data-body><div id="__nuxt"></div><!-- appended --><!-- after --><!-- document --></body></HTML>',
    )
  })

  it('leaves a document it cannot split unchanged', async () => {
    expect(await renderDocument('<div id="__nuxt"></div>', 'http://localhost/')).toBe('<div id="__nuxt"></div>')
  })
})
