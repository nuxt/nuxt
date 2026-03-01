import { AsyncLocalStorage } from 'node:async_hooks'
import { getPrefetchLinks, getPreloadLinks, getRequestDependencies, renderResourceHeaders } from 'vue-bundle-renderer/runtime'
import { renderToWebStream } from 'vue/server-renderer'
import type { RenderResponse } from 'nitropack/types'
import type { EventHandler } from 'h3'
import { appendResponseHeader, createError, getQuery, getRequestHeader, getResponseStatus, getResponseStatusText, writeEarlyHints } from 'h3'
import { getQuery as getURLQuery, joinURL } from 'ufo'
import { propsToString } from '@unhead/vue/server'
import { renderSSRHeadSuspenseChunk } from '@unhead/vue/stream/server'
import type { Link, Script } from '@unhead/vue/types'
import destr from 'destr'
import { defineRenderHandler, getRouteRules, useNitroApp } from 'nitropack/runtime'
import type { NuxtPayload, NuxtRenderHTMLContext, NuxtSSRContext } from 'nuxt/app'

import { APP_ROOT_CLOSE_TAG, APP_ROOT_OPEN_TAG, getRenderer, getServerApp } from '../utils/renderer/build-files'
import { payloadCache } from '../utils/cache'

import { renderPayloadJsonScript, renderPayloadResponse, renderPayloadScript, splitPayload } from '../utils/renderer/payload'
import { createSSRContext, setSSRError } from '../utils/renderer/app'
import { renderInlineStyles } from '../utils/renderer/inline-styles'
import { replaceIslandTeleports } from '../utils/renderer/islands'
// @ts-expect-error virtual file
import { NUXT_ASYNC_CONTEXT, NUXT_EARLY_HINTS, NUXT_INLINE_STYLES, NUXT_JSON_PAYLOADS, NUXT_NO_SCRIPTS, NUXT_PAYLOAD_EXTRACTION, NUXT_RUNTIME_PAYLOAD_EXTRACTION, NUXT_SSR_STREAMING, NUXT_SSR_STREAMING_BOT_RE, PARSE_ERROR_DATA } from '#internal/nuxt/nitro-config.mjs'
// @ts-expect-error virtual file
import { appHead, appTeleportAttrs, appTeleportTag, componentIslands, appManifest as isAppManifestEnabled } from '#internal/nuxt.config.mjs'
// @ts-expect-error virtual file
import entryIds from '#internal/nuxt/entry-ids.mjs'
// @ts-expect-error virtual file
import { entryFileName } from '#internal/entry-chunk.mjs'
// @ts-expect-error virtual file
import { buildAssetsURL, publicAssetsURL } from '#internal/nuxt/paths'
import { relative } from 'pathe'

// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__buildAssetsURL = buildAssetsURL
// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__publicAssetsURL = publicAssetsURL

// Polyfill for unctx (https://github.com/unjs/unctx#native-async-context)
if (NUXT_ASYNC_CONTEXT && !('AsyncLocalStorage' in globalThis)) {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage
}

const HAS_APP_TELEPORTS = !!(appTeleportTag && appTeleportAttrs.id)
const APP_TELEPORT_OPEN_TAG = HAS_APP_TELEPORTS ? `<${appTeleportTag}${propsToString(appTeleportAttrs)}>` : ''
const APP_TELEPORT_CLOSE_TAG = HAS_APP_TELEPORTS ? `</${appTeleportTag}>` : ''

const PAYLOAD_URL_RE = NUXT_JSON_PAYLOADS ? /^[^?]*\/_payload.json(?:\?.*)?$/ : /^[^?]*\/_payload.js(?:\?.*)?$/
const PAYLOAD_FILENAME = NUXT_JSON_PAYLOADS ? '_payload.json' : '_payload.js'

let entryPath: string

// Bot detection regex for SSR streaming (compiled once, tree-shaken when streaming disabled)
const SSR_BOT_RE = NUXT_SSR_STREAMING ? new RegExp(NUXT_SSR_STREAMING_BOT_RE, 'i') : null
// Bootstrap script for unhead streaming queue
const UNHEAD_STREAM_KEY = '__unhead__'
const UNHEAD_BOOTSTRAP_SCRIPT = NUXT_SSR_STREAMING ? `<script>window.${UNHEAD_STREAM_KEY}={_q:[],push(e){this._q.push(e)}}</script>` : ''

const handler: EventHandler = defineRenderHandler(async (event): Promise<Partial<RenderResponse>> => {
  const nitroApp = useNitroApp()

  // Whether we're rendering an error page
  const ssrError = event.path.startsWith('/__nuxt_error')
    ? getQuery(event) as unknown as NuxtPayload['error'] & { url: string }
    : null

  if (ssrError && !('__unenv__' in event.node.req) /* allow internal fetch */) {
    throw createError({
      status: 404,
      statusText: 'Page Not Found: /__nuxt_error',
      message: 'Page Not Found: /__nuxt_error',
    })
  }

  // Initialize ssr context
  const ssrContext: NuxtSSRContext = createSSRContext(event)

  ssrContext.head.push(appHead)

  if (ssrError) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const status = ssrError.status || ssrError.statusCode
    if (status) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      ssrError.status = ssrError.statusCode = Number.parseInt(status as any)
    }
    if (PARSE_ERROR_DATA && typeof ssrError.data === 'string') {
      try {
        ssrError.data = destr(ssrError.data)
      } catch {
        // ignore
      }
    }
    setSSRError(ssrContext, ssrError)
  }

  // Get route options (for `ssr: false`, `isr`, `cache` and `noScripts`)
  const routeOptions = getRouteRules(event)

  // Whether we are prerendering route or using ISR/SWR caching
  const _PAYLOAD_EXTRACTION = !ssrContext.noSSR && (
    (import.meta.prerender && NUXT_PAYLOAD_EXTRACTION)
    || (NUXT_RUNTIME_PAYLOAD_EXTRACTION && (routeOptions.isr || routeOptions.cache))
  )

  const isRenderingPayload = (_PAYLOAD_EXTRACTION || (import.meta.dev && routeOptions.prerender)) && PAYLOAD_URL_RE.test(ssrContext.url)
  if (isRenderingPayload) {
    const url = ssrContext.url.substring(0, ssrContext.url.lastIndexOf('/')) || '/'
    ssrContext.url = url

    event._path = event.node.req.url = url
    if (import.meta.prerender && await payloadCache!.hasItem(url)) {
      return payloadCache!.getItem(url) as Promise<Partial<RenderResponse>>
    }
  }

  if (routeOptions.ssr === false) {
    ssrContext.noSSR = true
  }

  const payloadURL = _PAYLOAD_EXTRACTION ? joinURL(ssrContext.runtimeConfig.app.cdnURL || ssrContext.runtimeConfig.app.baseURL, ssrContext.url.replace(/\?.*$/, ''), PAYLOAD_FILENAME) + '?' + ssrContext.runtimeConfig.app.buildId : undefined

  // Render app
  const renderer = await getRenderer(ssrContext)

  // Render 103 Early Hints
  if (NUXT_EARLY_HINTS && !isRenderingPayload && !import.meta.prerender) {
    const { link } = renderResourceHeaders({}, renderer.rendererContext)
    if (link) {
      writeEarlyHints(event, link)
    }
  }

  if (NUXT_INLINE_STYLES) {
    for (const id of entryIds) {
      ssrContext.modules!.add(id)
    }
  }

  // === SSR Streaming Path ===
  // Note: componentIslands is excluded because island teleport replacement
  // requires post-hoc string manipulation that is incompatible with streaming.
  if (NUXT_SSR_STREAMING
    && !ssrContext.noSSR
    && !ssrError
    && !isRenderingPayload
    && !import.meta.prerender
    && !componentIslands
    && routeOptions.streaming !== false
    && !SSR_BOT_RE!.test(getRequestHeader(event, 'user-agent') || '')) {
    return renderStreamedResponse({ event, ssrContext, renderer, nitroApp, routeOptions, ssrError, _PAYLOAD_EXTRACTION: _PAYLOAD_EXTRACTION!, payloadURL })
  }

  const _rendered = await renderer.renderToString(ssrContext).catch(async (error) => {
    // We use error to bypass full render if we have an early response we can make
    // TODO: remove _renderResponse in nuxt v5
    if ((ssrContext['~renderResponse'] || ssrContext._renderResponse) && error.message === 'skipping render') { return {} as ReturnType<typeof renderer['renderToString']> }

    // Use explicitly thrown error in preference to subsequent rendering errors
    const _err = (!ssrError && ssrContext.payload?.error) || error
    await ssrContext.nuxt?.hooks.callHook('app:error', _err)
    throw _err
  })

  // Render inline styles
  // TODO: remove _renderResponse in nuxt v5
  const inlinedStyles = NUXT_INLINE_STYLES && !ssrContext['~renderResponse'] && !ssrContext._renderResponse && !isRenderingPayload
    ? await renderInlineStyles(ssrContext.modules ?? [])
    : []

  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult: _rendered })

  if (ssrContext['~renderResponse'] || ssrContext._renderResponse) {
    // TODO: remove _renderResponse in nuxt v5
    return ssrContext['~renderResponse'] || (ssrContext._renderResponse as never)
  }

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

  if (_PAYLOAD_EXTRACTION && import.meta.prerender) {
    // Hint nitro to prerender payload for this route
    appendResponseHeader(event, 'x-nitro-prerender', joinURL(ssrContext.url.replace(/\?.*$/, ''), PAYLOAD_FILENAME))
    // Use same ssr context to generate payload for this route
    await payloadCache!.setItem(ssrContext.url === '/' ? '/' : ssrContext.url.replace(/\/$/, ''), renderPayloadResponse(ssrContext))
  }

  const NO_SCRIPTS = NUXT_NO_SCRIPTS || routeOptions.noScripts

  // Setup head
  const { styles, scripts } = getRequestDependencies(ssrContext, renderer.rendererContext)

  // 0. Add import map for stable chunk hashes
  if (entryFileName && !NO_SCRIPTS) {
    let path = entryPath
    if (!path) {
      path = buildAssetsURL(entryFileName) as string
      if (ssrContext.runtimeConfig.app.cdnURL || /^(?:\/|\.+\/)/.test(path)) {
        // cache absolute entry path
        entryPath = path
      } else {
        // TODO: provide support for relative paths in assets as well
        // relativise path
        path = relative(event.path.replace(/\/[^/]+$/, '/'), joinURL('/', path))
        if (!/^(?:\/|\.+\/)/.test(path)) {
          path = `./${path}`
        }
      }
    }
    ssrContext.head.push({
      script: [{
        tagPosition: 'head',
        tagPriority: -2,
        type: 'importmap',
        innerHTML: JSON.stringify({ imports: { '#entry': path } }),
      }],
    })
  }
  // 1. Preload payloads and app manifest
  if (_PAYLOAD_EXTRACTION && !NO_SCRIPTS) {
    ssrContext.head.push({
      link: [
        NUXT_JSON_PAYLOADS
          ? { rel: 'preload', as: 'fetch', crossorigin: 'anonymous', href: payloadURL }
          : { rel: 'modulepreload', crossorigin: '', href: payloadURL },
      ],
    })
  }

  if (isAppManifestEnabled && ssrContext['~preloadManifest'] && !NO_SCRIPTS) {
    ssrContext.head.push({
      link: [
        { rel: 'preload', as: 'fetch', fetchpriority: 'low', crossorigin: 'anonymous', href: buildAssetsURL(`builds/meta/${ssrContext.runtimeConfig.app.buildId}.json`) },
      ],
    }, { tagPriority: 'low' })
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
    ssrContext.head.push({ link })
  }

  if (!NO_SCRIPTS) {
    // 4. Resource Hints
    // Remove lazy hydrated modules from ssrContext.modules so they don't get preloaded
    // (CSS links are already added above, this only affects JS preloads)
    if (ssrContext['~lazyHydratedModules']) {
      for (const id of ssrContext['~lazyHydratedModules']) {
        ssrContext.modules?.delete(id)
      }
    }
    ssrContext.head.push({
      link: getPreloadLinks(ssrContext, renderer.rendererContext) as Link[],
    })
    ssrContext.head.push({
      link: getPrefetchLinks(ssrContext, renderer.rendererContext) as Link[],
    })
    // 5. Payloads
    ssrContext.head.push({
      script: _PAYLOAD_EXTRACTION
        ? NUXT_JSON_PAYLOADS
          ? renderPayloadJsonScript({ ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL })
          : renderPayloadScript({ ssrContext, data: splitPayload(ssrContext).initial, routeOptions, src: payloadURL })
        : NUXT_JSON_PAYLOADS
          ? renderPayloadJsonScript({ ssrContext, data: ssrContext.payload })
          : renderPayloadScript({ ssrContext, data: ssrContext.payload, routeOptions }),
    }, {
      // this should come before another end of body scripts
      tagPosition: 'bodyClose',
      tagPriority: 'high',
    })
  }

  // 6. Scripts
  if (!routeOptions.noScripts) {
    const tagPosition = (_PAYLOAD_EXTRACTION && !NUXT_JSON_PAYLOADS) ? 'bodyClose' : 'head'

    ssrContext.head.push({
      script: Object.values(scripts).map(resource => (<Script> {
        type: resource.module ? 'module' : null,
        src: renderer.rendererContext.buildAssetsURL(resource.file),
        defer: resource.module ? null : true,
        // if we are rendering script tag payloads that import an async payload
        // we need to ensure this resolves before executing the Nuxt entry
        tagPosition,
        crossorigin: '',
      })),
    })
  }

  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = ssrContext.head.render()

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

export default handler

async function renderStreamedResponse (ctx: {
  event: Parameters<Parameters<typeof defineRenderHandler>[0]>[0]
  ssrContext: NuxtSSRContext
  renderer: Awaited<ReturnType<typeof getRenderer>>
  nitroApp: ReturnType<typeof useNitroApp>
  routeOptions: ReturnType<typeof getRouteRules>
  ssrError: (NuxtPayload['error'] & { url: string }) | null
  _PAYLOAD_EXTRACTION: boolean
  payloadURL: string | undefined
}): Promise<Partial<RenderResponse>> {
  const { event, ssrContext, renderer, nitroApp, routeOptions, ssrError, _PAYLOAD_EXTRACTION, payloadURL } = ctx
  const NO_SCRIPTS = NUXT_NO_SCRIPTS || routeOptions.noScripts

  // 1. Set HTTP Link headers with entry-point preload hints (fastest resource hinting)
  const { link: linkHeader } = renderResourceHeaders({}, renderer.rendererContext)
  if (linkHeader) {
    appendResponseHeader(event, 'link', linkHeader)
  }

  // 2. Pre-compute entry-point inline styles for the shell
  const entryInlineStyles = NUXT_INLINE_STYLES
    ? await renderInlineStyles(new Set(entryIds))
    : []

  // 3. Push shell head entries (known before rendering)
  if (entryInlineStyles.length) {
    ssrContext.head.push({ style: entryInlineStyles })
  }

  // Entry CSS stylesheet links
  const { styles: entryStyles, scripts: entryScripts } = getRequestDependencies({}, renderer.rendererContext)
  const shellLinks: Link[] = []
  for (const resource of Object.values(entryStyles)) {
    if (import.meta.dev && 'inline' in getURLQuery(resource.file)) { continue }
    shellLinks.push({ rel: 'stylesheet', href: renderer.rendererContext.buildAssetsURL(resource.file), crossorigin: '' })
  }
  if (shellLinks.length) {
    ssrContext.head.push({ link: shellLinks })
  }

  // Import map
  if (entryFileName && !NO_SCRIPTS) {
    let path = entryPath
    if (!path) {
      path = buildAssetsURL(entryFileName) as string
      if (ssrContext.runtimeConfig.app.cdnURL || /^(?:\/|\.+\/)/.test(path)) {
        entryPath = path
      } else {
        path = relative(event.path.replace(/\/[^/]+$/, '/'), joinURL('/', path))
        if (!/^(?:\/|\.+\/)/.test(path)) { path = `./${path}` }
      }
    }
    ssrContext.head.push({
      script: [{
        tagPosition: 'head',
        tagPriority: -2,
        type: 'importmap',
        innerHTML: JSON.stringify({ imports: { '#entry': path } }),
      }],
    })
  }

  // Payload preload links
  if (_PAYLOAD_EXTRACTION && !NO_SCRIPTS) {
    ssrContext.head.push({
      link: [
        NUXT_JSON_PAYLOADS
          ? { rel: 'preload', as: 'fetch', crossorigin: 'anonymous', href: payloadURL }
          : { rel: 'modulepreload', crossorigin: '', href: payloadURL },
      ],
    })
  }

  // Entry preload/prefetch links
  if (!NO_SCRIPTS) {
    ssrContext.head.push({
      link: getPreloadLinks({}, renderer.rendererContext) as Link[],
    })
    ssrContext.head.push({
      link: getPrefetchLinks({}, renderer.rendererContext) as Link[],
    })
  }

  // Entry scripts
  if (!routeOptions.noScripts) {
    const tagPosition = (_PAYLOAD_EXTRACTION && !NUXT_JSON_PAYLOADS) ? 'bodyClose' as const : 'head' as const
    ssrContext.head.push({
      script: Object.values(entryScripts).map(resource => (<Script> {
        type: resource.module ? 'module' : null,
        src: renderer.rendererContext.buildAssetsURL(resource.file),
        defer: resource.module ? null : true,
        tagPosition,
        crossorigin: '',
      })),
    })
  }

  // 4. Render the shell head
  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = ssrContext.head.render()
  ssrContext.head.entries.clear()

  // 5. Build the HTML shell
  const shellHtml = '<!DOCTYPE html>'
    + `<html${htmlAttrs ? ' ' + htmlAttrs : ''}>`
    + `<head>${UNHEAD_BOOTSTRAP_SCRIPT}${headTags}</head>`
    + `<body${bodyAttrs ? ' ' + bodyAttrs : ''}>`
    + (bodyTagsOpen || '')

  // 6. Get the Vue app and create a web stream
  const createSSRApp = await getServerApp()
  const vueStream = renderToWebStream(await createSSRApp(ssrContext), ssrContext)

  // 7. Build the streaming response
  const encoder = new TextEncoder()
  const outputStream = new ReadableStream<Uint8Array>({
    async start (controller) {
      try {
        // Send shell + app root open tag
        controller.enqueue(encoder.encode(shellHtml + APP_ROOT_OPEN_TAG))

        // Pipe Vue stream, injecting head suspense chunks
        const reader = vueStream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) { break }
            controller.enqueue(value)

            // Inject head updates from resolved suspense boundaries
            const headChunk = renderSSRHeadSuspenseChunk(ssrContext.head)
            if (headChunk) {
              controller.enqueue(encoder.encode(`<script>${headChunk}</script>`))
            }
          }
        } finally {
          reader.releaseLock()
        }

        // Stream complete — build closing HTML
        await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult: {} as any })

        // Handle errors that occurred during streaming.
        // Since the HTTP status is already committed (200), the error is
        // injected into the payload so the client can render the error page.
        if (ssrContext.payload?.error && !ssrError) {
          await ssrContext.nuxt?.hooks.callHook('app:error', ssrContext.payload.error)
        }

        // Build payload scripts (payload is now finalized)
        if (!NO_SCRIPTS) {
          ssrContext.head.push({
            script: _PAYLOAD_EXTRACTION
              ? NUXT_JSON_PAYLOADS
                ? renderPayloadJsonScript({ ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL })
                : renderPayloadScript({ ssrContext, data: splitPayload(ssrContext).initial, routeOptions, src: payloadURL })
              : NUXT_JSON_PAYLOADS
                ? renderPayloadJsonScript({ ssrContext, data: ssrContext.payload })
                : renderPayloadScript({ ssrContext, data: ssrContext.payload, routeOptions }),
          }, {
            tagPosition: 'bodyClose',
            tagPriority: 'high',
          })
        }

        // Render any final head updates (payload scripts, etc.)
        const closingHead = ssrContext.head.render()

        // Call render:html hook with partial context (body is already streamed)
        const htmlContext: NuxtRenderHTMLContext = {
          htmlAttrs: [],
          head: [],
          bodyAttrs: [],
          bodyPrepend: [],
          body: [], // body was already streamed
          bodyAppend: normalizeChunks([bodyTags, closingHead.bodyTags]),
        }
        await nitroApp.hooks.callHook('render:html', htmlContext, { event })

        // Teleports + closing tags
        const teleportHtml = APP_TELEPORT_OPEN_TAG
          + (HAS_APP_TELEPORTS ? joinTags([ssrContext.teleports?.[`#${appTeleportAttrs.id}`]]) : '')
          + APP_TELEPORT_CLOSE_TAG

        const closingHtml = APP_ROOT_CLOSE_TAG
          + teleportHtml
          + joinTags(htmlContext.bodyAppend)
          + '</body></html>'

        controller.enqueue(encoder.encode(closingHtml))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return {
    body: outputStream,
    statusCode: getResponseStatus(event),
    statusMessage: getResponseStatusText(event),
    headers: {
      'content-type': 'text/html;charset=utf-8',
      'x-powered-by': 'Nuxt',
    },
  }
}

function normalizeChunks (chunks: (string | undefined)[]) {
  const result: string[] = []
  for (const _chunk of chunks) {
    const chunk = _chunk?.trim()
    if (chunk) {
      result.push(chunk)
    }
  }
  return result
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
