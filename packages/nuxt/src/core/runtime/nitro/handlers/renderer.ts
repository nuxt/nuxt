import { AsyncLocalStorage } from 'node:async_hooks'
import {
  getPrefetchLinks,
  getPreloadLinks,
  getRequestDependencies,
  renderResourceHeaders,
} from 'vue-bundle-renderer/runtime'
import type { RenderResponse } from 'nitro/types'
import { appendResponseHeader, createError, getQuery, getResponseStatus, getResponseStatusText, writeEarlyHints } from 'h3'
import { getQuery as getURLQuery, joinURL, withoutTrailingSlash } from 'ufo'
import { propsToString, renderSSRHead } from '@unhead/vue/server'
import type { HeadEntryOptions, Link, Script } from '@unhead/vue/types'

import { defineRenderHandler, getRouteRules, useNitroApp } from 'nitro/runtime'
import type { NuxtPayload, NuxtSSRContext } from 'nuxt/app'

import { getEntryIds, getRenderer } from '../utils/renderer/build-files'
import { payloadCache } from '../utils/cache'

import { renderPayloadJsonScript, renderPayloadResponse, renderPayloadScript, splitPayload } from '../utils/renderer/payload'
import { createSSRContext, setSSRError } from '../utils/renderer/app'
import { renderInlineStyles } from '../utils/renderer/inline-styles'
import { replaceIslandTeleports } from '../utils/renderer/islands'
// @ts-expect-error virtual file
import { renderSSRHeadOptions } from '#internal/unhead.config.mjs'

// @ts-expect-error virtual file
import { appHead, appTeleportAttrs, appTeleportTag, componentIslands, appManifest as isAppManifestEnabled } from '#internal/nuxt.config.mjs'
// @ts-expect-error virtual file
import { buildAssetsURL, publicAssetsURL } from '#internal/nuxt/paths'

// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__buildAssetsURL = buildAssetsURL
// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__publicAssetsURL = publicAssetsURL

// Polyfill for unctx (https://github.com/unjs/unctx#native-async-context)
if (process.env.NUXT_ASYNC_CONTEXT && !('AsyncLocalStorage' in globalThis)) {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage
}

export interface NuxtRenderHTMLContext {
  htmlAttrs: string[]
  head: string[]
  bodyAttrs: string[]
  bodyPrepend: string[]
  body: string[]
  bodyAppend: string[]
}

export interface NuxtRenderResponse {
  body: string
  statusCode: number
  statusMessage?: string
  headers: Record<string, string>
}

const HAS_APP_TELEPORTS = !!(appTeleportTag && appTeleportAttrs.id)
const APP_TELEPORT_OPEN_TAG = HAS_APP_TELEPORTS ? `<${appTeleportTag}${propsToString(appTeleportAttrs)}>` : ''
const APP_TELEPORT_CLOSE_TAG = HAS_APP_TELEPORTS ? `</${appTeleportTag}>` : ''

const PAYLOAD_URL_RE = process.env.NUXT_JSON_PAYLOADS ? /^[^?]*\/_payload.json(?:\?.*)?$/ : /^[^?]*\/_payload.js(?:\?.*)?$/
const PAYLOAD_FILENAME = process.env.NUXT_JSON_PAYLOADS ? '_payload.json' : '_payload.js'

export default defineRenderHandler(async (event): Promise<Partial<RenderResponse>> => {
  const nitroApp = useNitroApp()

  // Whether we're rendering an error page
  const ssrError = event.path.startsWith('/__nuxt_error')
    ? getQuery(event) as unknown as NuxtPayload['error'] & { url: string }
    : null

  if (ssrError && !('__unenv__' in event.node.req) /* allow internal fetch */) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Page Not Found: /__nuxt_error',
    })
  }

  // Initialize ssr context
  const ssrContext: NuxtSSRContext = createSSRContext(event)

  // needed for hash hydration plugin to work
  const headEntryOptions: HeadEntryOptions = { mode: 'server' }
  ssrContext.head.push(appHead, headEntryOptions)

  if (ssrError && ssrError.statusCode) {
    ssrError.statusCode = Number.parseInt(ssrError.statusCode as any)
    setSSRError(ssrContext, ssrError)
  }

  // Whether we are rendering payload route
  const isRenderingPayload = process.env.NUXT_PAYLOAD_EXTRACTION && PAYLOAD_URL_RE.test(ssrContext.url)
  if (isRenderingPayload) {
    const url = ssrContext.url.substring(0, ssrContext.url.lastIndexOf('/')) || '/'
    ssrContext.url = url

    event._path = event.node.req.url = url
    if (import.meta.prerender && await payloadCache!.hasItem(url)) {
      return payloadCache!.getItem(url) as Promise<Partial<RenderResponse>>
    }
  }

  // Get route options (currently to apply `ssr: false`)
  const routeOptions = getRouteRules(event)

  if (routeOptions.ssr === false) {
    ssrContext.noSSR = true
  }

  // Whether we are prerendering route
  const _PAYLOAD_EXTRACTION = import.meta.prerender && process.env.NUXT_PAYLOAD_EXTRACTION && !ssrContext.noSSR
  const payloadURL = _PAYLOAD_EXTRACTION ? joinURL(ssrContext.runtimeConfig.app.cdnURL || ssrContext.runtimeConfig.app.baseURL, ssrContext.url.replace(/\?.*$/, ''), PAYLOAD_FILENAME) + '?' + ssrContext.runtimeConfig.app.buildId : undefined

  // Render app
  const renderer = await getRenderer(ssrContext)

  // Render 103 Early Hints
  if (process.env.NUXT_EARLY_HINTS && !isRenderingPayload && !import.meta.prerender) {
    const { link } = renderResourceHeaders({}, renderer.rendererContext)
    if (link) {
      writeEarlyHints(event, link)
    }
  }

  if (process.env.NUXT_INLINE_STYLES) {
    for (const id of await getEntryIds()) {
      ssrContext.modules!.add(id)
    }
  }

  const _rendered = await renderer.renderToString(ssrContext).catch(async (error) => {
    // We use error to bypass full render if we have an early response we can make
    if (ssrContext._renderResponse && error.message === 'skipping render') { return {} as ReturnType<typeof renderer['renderToString']> }

    // Use explicitly thrown error in preference to subsequent rendering errors
    const _err = (!ssrError && ssrContext.payload?.error) || error
    await ssrContext.nuxt?.hooks.callHook('app:error', _err)
    throw _err
  })

  // Render inline styles
  const inlinedStyles = process.env.NUXT_INLINE_STYLES && !ssrContext._renderResponse && !isRenderingPayload
    ? await renderInlineStyles(ssrContext.modules ?? [])
    : []

  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult: _rendered })

  if (ssrContext._renderResponse) { return ssrContext._renderResponse }

  // Handle errors
  if (ssrContext.payload?.error && !ssrError) {
    throw ssrContext.payload.error
  }

  // Directly render payload routes
  if (isRenderingPayload) {
    const response = renderPayloadResponse(ssrContext)
    if (import.meta.prerender) {
      await payloadCache!.setItem(ssrContext.url, response)
    }
    return response
  }

  if (_PAYLOAD_EXTRACTION) {
    // Hint nitro to prerender payload for this route
    appendResponseHeader(event, 'x-nitro-prerender', joinURL(ssrContext.url.replace(/\?.*$/, ''), PAYLOAD_FILENAME))
    // Use same ssr context to generate payload for this route
    await payloadCache!.setItem(withoutTrailingSlash(ssrContext.url), renderPayloadResponse(ssrContext))
  }

  const NO_SCRIPTS = process.env.NUXT_NO_SCRIPTS || routeOptions.noScripts

  // Setup head
  const { styles, scripts } = getRequestDependencies(ssrContext, renderer.rendererContext)
  // 1. Preload payloads and app manifest
  if (_PAYLOAD_EXTRACTION && !NO_SCRIPTS) {
    ssrContext.head.push({
      link: [
        process.env.NUXT_JSON_PAYLOADS
          ? { rel: 'preload', as: 'fetch', crossorigin: 'anonymous', href: payloadURL }
          : { rel: 'modulepreload', crossorigin: '', href: payloadURL },
      ],
    }, headEntryOptions)
  }

  if (isAppManifestEnabled && ssrContext._preloadManifest) {
    ssrContext.head.push({
      link: [
        { rel: 'preload', as: 'fetch', fetchpriority: 'low', crossorigin: 'anonymous', href: buildAssetsURL(`builds/meta/${ssrContext.runtimeConfig.app.buildId}.json`) },
      ],
    }, { ...headEntryOptions, tagPriority: 'low' })
  }

  // 2. Styles
  if (inlinedStyles.length) {
    ssrContext.head.push({ style: inlinedStyles })
  }

  const link: Link[] = []
  for (const resource of Object.values(styles)) {
    // Do not add links to resources that are inlined (vite v5+)
    if (import.meta.dev && 'inline' in getURLQuery(resource.file)) {
      continue
    }
    // Add CSS links in <head> for CSS files
    // - in production
    // - in dev mode when not rendering an island
    link.push({ rel: 'stylesheet', href: renderer.rendererContext.buildAssetsURL(resource.file), crossorigin: '' })
  }

  if (link.length) {
    ssrContext.head.push({ link }, headEntryOptions)
  }

  if (!NO_SCRIPTS) {
    // 4. Resource Hints
    // TODO: add priorities based on Capo
    ssrContext.head.push({
      link: getPreloadLinks(ssrContext, renderer.rendererContext) as Link[],
    }, headEntryOptions)
    ssrContext.head.push({
      link: getPrefetchLinks(ssrContext, renderer.rendererContext) as Link[],
    }, headEntryOptions)
    // 5. Payloads
    ssrContext.head.push({
      script: _PAYLOAD_EXTRACTION
        ? process.env.NUXT_JSON_PAYLOADS
          ? renderPayloadJsonScript({ ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL })
          : renderPayloadScript({ ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL })
        : process.env.NUXT_JSON_PAYLOADS
          ? renderPayloadJsonScript({ ssrContext, data: ssrContext.payload })
          : renderPayloadScript({ ssrContext, data: ssrContext.payload }),
    }, {
      ...headEntryOptions,
      // this should come before another end of body scripts
      tagPosition: 'bodyClose',
      tagPriority: 'high',
    })
  }

  // 6. Scripts
  if (!routeOptions.noScripts) {
    ssrContext.head.push({
      script: Object.values(scripts).map(resource => (<Script> {
        type: resource.module ? 'module' : null,
        src: renderer.rendererContext.buildAssetsURL(resource.file),
        defer: resource.module ? null : true,
        // if we are rendering script tag payloads that import an async payload
        // we need to ensure this resolves before executing the Nuxt entry
        tagPosition: (_PAYLOAD_EXTRACTION && !process.env.NUXT_JSON_PAYLOADS) ? 'bodyClose' : 'head',
        crossorigin: '',
      })),
    }, headEntryOptions)
  }

  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = await renderSSRHead(ssrContext.head, renderSSRHeadOptions)

  // Create render context
  const htmlContext: NuxtRenderHTMLContext = {
    htmlAttrs: htmlAttrs ? [htmlAttrs] : [],
    head: normalizeChunks([headTags]),
    bodyAttrs: bodyAttrs ? [bodyAttrs] : [],
    bodyPrepend: normalizeChunks([bodyTagsOpen, ssrContext.teleports?.body]),
    body: [
      componentIslands ? replaceIslandTeleports(ssrContext, _rendered.html) : _rendered.html,
      APP_TELEPORT_OPEN_TAG + (HAS_APP_TELEPORTS ? joinTags([ssrContext.teleports?.[`#${appTeleportAttrs.id}`]]) : '') + APP_TELEPORT_CLOSE_TAG,
    ],
    bodyAppend: [bodyTags],
  }

  // Allow hooking into the rendered result
  await nitroApp.hooks.callHook('render:html', htmlContext, { event })

  // Construct HTML response
  return {
    body: renderHTMLDocument(htmlContext),
    statusCode: getResponseStatus(event),
    statusMessage: getResponseStatusText(event),
    headers: {
      'content-type': 'text/html;charset=utf-8',
      'x-powered-by': 'Nuxt',
    },
  } satisfies RenderResponse
})

function normalizeChunks (chunks: (string | undefined)[]) {
  return chunks.filter(Boolean).map(i => i!.trim())
}

function joinTags (tags: Array<string | undefined>) {
  return tags.join('')
}

function joinAttrs (chunks: string[]) {
  if (chunks.length === 0) { return '' }
  return ' ' + chunks.join(' ')
}

function renderHTMLDocument (html: NuxtRenderHTMLContext) {
  return '<!DOCTYPE html>' +
    `<html${joinAttrs(html.htmlAttrs)}>` +
    `<head>${joinTags(html.head)}</head>` +
    `<body${joinAttrs(html.bodyAttrs)}>${joinTags(html.bodyPrepend)}${joinTags(html.body)}${joinTags(html.bodyAppend)}</body>` +
    '</html>'
}
