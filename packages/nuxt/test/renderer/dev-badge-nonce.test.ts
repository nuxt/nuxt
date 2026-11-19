import { describe, expect, it, vi } from 'vitest'

import type { NuxtRenderHTMLContext } from '../../src/app/types.ts'
import { stampDevBadgeNonce } from '../../src/runtime/server/renderer/document.ts'
import type { NuxtRendererOptions, RendererEvent } from '../../src/runtime/server/renderer/runtime.ts'

// https://github.com/nuxt/nuxt/issues/37120
describe('stampDevBadgeNonce', () => {
  const badge = '<script>window.__NUXT_DEV_ERROR__={}</script>'
  const event = {} as RendererEvent

  function setup (context: Partial<NuxtRenderHTMLContext>) {
    const renderDevBadge = vi.fn((_event: RendererEvent, nonce?: string) => Promise.resolve(`<script nonce="${nonce}">window.__NUXT_DEV_ERROR__={}</script>`))
    const runtime = { renderDevBadge } as unknown as NuxtRendererOptions
    const html: NuxtRenderHTMLContext = { htmlAttrs: [], head: ['<title>x</title>', badge], bodyAttrs: [], bodyPrepend: [], body: [], bodyAppend: [], ...context }
    return { runtime, renderDevBadge, html }
  }

  it('re-renders the badge with a nonce a `render:html` listener added', async () => {
    const { runtime, renderDevBadge, html } = setup({ bodyAppend: ['<script nonce="fromhook">window.app=1</script>'] })

    await stampDevBadgeNonce(runtime, event, html, badge, undefined)

    expect(renderDevBadge).toHaveBeenCalledWith(event, 'fromhook')
    expect(html.head).toEqual(['<title>x</title>', '<script nonce="fromhook">window.__NUXT_DEV_ERROR__={}</script>'])
  })

  it('re-renders the badge with a nonce a listener added to a script in the body', async () => {
    const { runtime, renderDevBadge, html } = setup({ body: ['<div>app</div><script nonce="inbody">window.app=1</script>'] })

    await stampDevBadgeNonce(runtime, event, html, badge, undefined)

    expect(renderDevBadge).toHaveBeenCalledWith(event, 'inbody')
    expect(html.head[1]).toContain('nonce="inbody"')
  })

  it('ignores a nonce on a commented-out script', async () => {
    const { runtime, renderDevBadge, html } = setup({ body: ['<!-- <script nonce="example"></script> --><script nonce="real">window.app=1</script>'] })

    await stampDevBadgeNonce(runtime, event, html, badge, undefined)

    expect(renderDevBadge).toHaveBeenCalledWith(event, 'real')
  })

  it('keeps the badge when it was already rendered with the head nonce', async () => {
    const { runtime, renderDevBadge, html } = setup({ bodyAppend: ['<script nonce="fromhook"></script>'] })

    await stampDevBadgeNonce(runtime, event, html, badge, 'fromhead')

    expect(renderDevBadge).not.toHaveBeenCalled()
    expect(html.head[1]).toBe(badge)
  })

  it('keeps the badge when no nonce was added', async () => {
    const { runtime, renderDevBadge, html } = setup({ bodyAppend: ['<script>window.app=1</script>'] })

    await stampDevBadgeNonce(runtime, event, html, badge, undefined)

    expect(renderDevBadge).not.toHaveBeenCalled()
    expect(html.head[1]).toBe(badge)
  })

  it('leaves a badge that a listener already changed', async () => {
    const changed = '<script nonce="manual">window.__NUXT_DEV_ERROR__={}</script>'
    const { runtime, renderDevBadge, html } = setup({ head: [changed], bodyAppend: ['<script nonce="fromhook"></script>'] })

    await stampDevBadgeNonce(runtime, event, html, badge, undefined)

    expect(renderDevBadge).not.toHaveBeenCalled()
    expect(html.head).toEqual([changed])
  })
})
