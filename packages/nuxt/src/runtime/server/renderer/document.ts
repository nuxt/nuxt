import { propsToString } from '@unhead/vue/server'
import type { SSRHeadPayload } from '@unhead/vue/server'
import type { NuxtRenderHTMLContext, NuxtSSRContext } from '#app/types'
import { appTeleportAttrs, appTeleportTag } from 'nuxt/internal/renderer-config'
import type { NuxtRendererOptions, RendererEvent } from './runtime'

const APP_TELEPORT_ID = appTeleportTag && appTeleportAttrs.id ? `#${appTeleportAttrs.id}` : undefined
const APP_TELEPORT_OPEN_TAG = APP_TELEPORT_ID ? `<${appTeleportTag}${propsToString(appTeleportAttrs)}>` : ''
const APP_TELEPORT_CLOSE_TAG = APP_TELEPORT_ID ? `</${appTeleportTag}>` : ''

/** The app teleport target, holding what the render teleported into it. */
export function renderAppTeleports (ssrContext: NuxtSSRContext): string {
  return APP_TELEPORT_OPEN_TAG + (APP_TELEPORT_ID ? ssrContext.teleports?.[APP_TELEPORT_ID] ?? '' : '') + APP_TELEPORT_CLOSE_TAG
}

/** The dev error badge for the head of a page, unless it runs no scripts. */
export function renderDevBadge (runtime: NuxtRendererOptions, event: RendererEvent, noScripts: boolean, nonce?: string): Promise<string | undefined> | undefined {
  if (!import.meta.test && !noScripts) {
    return runtime.renderDevBadge?.(event, nonce).catch(() => undefined)
  }
}

export function normalizeChunks (chunks: (string | undefined)[]): string[] {
  const result: string[] = []
  for (const _chunk of chunks) {
    const chunk = _chunk?.trim()
    if (chunk) {
      result.push(chunk)
    }
  }
  return result
}

export function joinTags (tags: Array<string | undefined>): string {
  return tags.join('')
}

function joinAttrs (chunks: string[]) {
  if (chunks.length === 0) { return '' }
  return ' ' + chunks.join(' ')
}

/** The document up to and including `bodyPrepend`. */
export function renderDocumentOpen (html: Pick<NuxtRenderHTMLContext, 'htmlAttrs' | 'head' | 'bodyAttrs' | 'bodyPrepend'>): string {
  return '<!DOCTYPE html>'
    + `<html${joinAttrs(html.htmlAttrs)}>`
    + `<head>${joinTags(html.head)}</head>`
    + `<body${joinAttrs(html.bodyAttrs)}>${joinTags(html.bodyPrepend)}`
}

export function renderHTMLDocument (html: NuxtRenderHTMLContext): string {
  return renderDocumentOpen(html) + `${joinTags(html.body)}${joinTags(html.bodyAppend)}</body></html>`
}

/** The document with the app markup kept as the chunks it was rendered in. */
export function renderHTMLDocumentChunks (html: NuxtRenderHTMLContext, appChunks: string[]): string[] {
  return [renderDocumentOpen(html), ...appChunks, `${html.body[1]}${joinTags(html.bodyAppend)}</body></html>`]
}

/**
 * Apply `renderSSRHeadOptions` to the output of `head.render()`. `omitLineBreaks` is not a
 * `createHead` option, and line breaks only ever separate tags.
 */
export function applyRenderOptions (payload: SSRHeadPayload, options: { omitLineBreaks?: boolean }): SSRHeadPayload {
  if (!options.omitLineBreaks) { return payload }
  return {
    headTags: payload.headTags.replaceAll('\n', ''),
    bodyTags: payload.bodyTags.replaceAll('\n', ''),
    bodyTagsOpen: payload.bodyTagsOpen.replaceAll('\n', ''),
    htmlAttrs: payload.htmlAttrs,
    bodyAttrs: payload.bodyAttrs,
  }
}
