import { createRendererPluginHooks } from 'nuxt/internal/renderer/plugins'
import type { NuxtServerRendererHooks } from 'nuxt/server'

import { createRequestEvent } from './event.ts'

const DOCUMENT_RE = /^([\s\S]*?)<html(\s[^>]*)?>([\s\S]*?)<head(\s[^>]*)?>([\s\S]*)<\/head>([\s\S]*?)<body(\s[^>]*)?>([\s\S]*)<\/body>([\s\S]*)$/i

const hooks = createRendererPluginHooks()

/** Render the static SPA document for `url` through the `render:html` hooks of the renderer plugins. */
export default async function renderDocument (html: string, url: string): Promise<string> {
  const match = DOCUMENT_RE.exec(html)
  if (!hooks || !match) {
    return html
  }
  const [, prologue, htmlAttrs, beforeHead, headAttrs = '', head, between, bodyAttrs, body, epilogue] = match
  const htmlContext: Parameters<NuxtServerRendererHooks['render:html']>[0] = {
    htmlAttrs: htmlAttrs?.trim() ? [htmlAttrs.trim()] : [],
    head: [head!],
    bodyAttrs: bodyAttrs?.trim() ? [bodyAttrs.trim()] : [],
    bodyPrepend: [],
    body: [body!],
    bodyAppend: [],
  }

  await hooks.callHook('render:html', htmlContext, { event: createRequestEvent(new Request(url)) })

  return prologue
    + `<html${attrs(htmlContext.htmlAttrs)}>${beforeHead}`
    + `<head${headAttrs}>${htmlContext.head.join('')}</head>${between}`
    + `<body${attrs(htmlContext.bodyAttrs)}>${htmlContext.bodyPrepend.join('')}${htmlContext.body.join('')}${htmlContext.bodyAppend.join('')}</body>`
    + epilogue
}

function attrs (chunks: string[]): string {
  return chunks.length ? ' ' + chunks.join(' ') : ''
}
