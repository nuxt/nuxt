import { AsyncLocalStorage } from 'node:async_hooks'
import { getPrefetchLinks, getPreloadLinks, getRequestDependencies, renderResourceHeaders } from 'vue-bundle-renderer/runtime'
import { renderToWebStream } from 'vue/server-renderer'
import type { RenderResponse } from 'nitro/types'
import type { H3Event } from 'nitro/h3'
import { HTTPError, defineEventHandler, getQuery, writeEarlyHints } from 'nitro/h3'
import { getQuery as getURLQuery, joinURL } from 'ufo'
import { propsToString, renderSSRHead } from '@unhead/vue/server'
import type { SSRHeadPayload } from '@unhead/vue/server'
import { createBootstrapScript, renderSSRHeadSuspenseChunk, renderShell } from '@unhead/vue/stream/server'
import { streamingIifeCode } from '@unhead/vue/stream/iife'
import type { Link, Script } from '@unhead/vue/types'
import destr from 'destr'
import { getRouteRules, useNitroHooks } from 'nitro/app'
import { relative } from 'pathe'

import type { NuxtPayload, NuxtRenderHTMLContext, NuxtSSRContext } from 'nuxt/app'

import { APP_ROOT_CLOSE_TAG, APP_ROOT_OPEN_TAG, getRenderer, getServerApp } from '../utils/renderer/build-files'
import { payloadCache, prerenderRenderingURLs } from '../utils/cache'

import { renderPayloadJsonScript, renderPayloadResponse, splitPayload } from '../utils/renderer/payload'
import { createSSRContext, setSSRError } from '../utils/renderer/app'
import { renderInlineStyles } from '../utils/renderer/inline-styles'
import { replaceIslandTeleports } from '../utils/renderer/islands'
// @ts-expect-error virtual file
import { renderSSRHeadOptions } from '#internal/unhead.config.mjs'
// @ts-expect-error virtual file
import { NUXT_ASYNC_CONTEXT, NUXT_EARLY_HINTS, NUXT_INLINE_STYLES, NUXT_NO_SCRIPTS, NUXT_PAYLOAD_EXTRACTION, NUXT_PAYLOAD_INLINE, NUXT_RUNTIME_PAYLOAD_EXTRACTION, NUXT_SSR_STREAMING, NUXT_SSR_STREAMING_BOT_RE, PARSE_ERROR_DATA } from '#internal/nuxt/nitro-config.mjs'
// @ts-expect-error virtual file
import { appHead, appTeleportAttrs, appTeleportTag, componentIslands } from '#internal/nuxt.config.mjs'
// @ts-expect-error virtual file
import entryIds from '#internal/nuxt/entry-ids.mjs'
// @ts-expect-error virtual file
import { entryFileName } from '#internal/entry-chunk.mjs'
// @ts-expect-error virtual file
import { iifeChunkFileName } from '#internal/streaming-iife-chunk.mjs'
// @ts-expect-error virtual file
import { buildAssetsURL, publicAssetsURL } from '#internal/nuxt/paths'
import type { AppConfig } from '@nuxt/schema'

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

const PAYLOAD_URL_RE = /^[^?]*\/_payload.json(?:\?.*)?$/
const PAYLOAD_FILENAME = '_payload.json'

let entryPath: string

// Bot detection regex for SSR streaming (compiled once, tree-shaken when streaming disabled)
const SSR_BOT_RE = NUXT_SSR_STREAMING ? new RegExp(NUXT_SSR_STREAMING_BOT_RE, 'i') : null

const handler: ReturnType<typeof defineEventHandler> = defineEventHandler((event) => {
  // Whether we're rendering an error page
  const ssrError = event.url.pathname.startsWith('/__nuxt_error')
    ? getQuery<NuxtPayload['error'] & { url: string }>(event)
    : null

  if (ssrError && !event.context.nuxt?.['~internal'] /* allow internal fetch */) {
    throw new HTTPError({
      status: 404,
      statusText: 'Page Not Found: /__nuxt_error',
    })
  }

  // During prerender, refuse to recurse into a URL that is already rendering
  // higher in the same call chain. Without this, a `useFetch`/`$fetch` against
  // the in-flight URL (typically from route middleware) silently deadlocks the
  // build. See https://github.com/nuxt/nuxt/issues/33871.
  if (import.meta.prerender && prerenderRenderingURLs) {
    const renderingURL = event.url.pathname + event.url.search
    const stack = prerenderRenderingURLs.getStore()
    if (stack?.includes(renderingURL)) {
      const chain = [...stack, renderingURL].filter(url => !url.startsWith('/__nuxt_error')).map(url => `"${url}"`).join(' -> ')
      throw new HTTPError({
        status: 508,
        statusText: `Loop detected while prerendering "${renderingURL}" (${chain}). Check for \`useFetch\`/\`$fetch\` calls targeting a URL that is currently being rendered.`,
      })
    }
    return prerenderRenderingURLs.run([...(stack || []), renderingURL], () => renderRoute(event, ssrError))
  }

  return renderRoute(event, ssrError)
})

async function renderRoute (event: H3Event, ssrError: (NuxtPayload['error'] & { url: string }) | null) {
  // Initialize ssr context
  const ssrContext: NuxtSSRContext = createSSRContext(event)

  ssrContext.head.push(appHead)

  if (ssrError) {
    // @ts-expect-error TODO: investigate creating new error
    ssrError.status &&= Number.parseInt(ssrError.status.toString())
    if (PARSE_ERROR_DATA && typeof ssrError.data === 'string') {
      try {
        // @ts-expect-error TODO: investigate creating new error
        ssrError.data = destr(ssrError.data)
      } catch {
        // ignore
      }
    }
    setSSRError(ssrContext, ssrError)
  }

  // Get route options (for `ssr: false`, `isr`, `cache` and `noScripts`)
  const routeOptions = getRouteRules(event.req.method, event.url.pathname).routeRules || {}

  if (!routeOptions?.ssr) {
    ssrContext.noSSR = true
  }

  // Whether we are prerendering route or using ISR/SWR caching
  const _PAYLOAD_EXTRACTION = !ssrContext.noSSR && (
    (import.meta.prerender && NUXT_PAYLOAD_EXTRACTION)
    || (NUXT_RUNTIME_PAYLOAD_EXTRACTION && (routeOptions.isr || routeOptions.cache))
  )

  // When NUXT_PAYLOAD_INLINE is true (payloadExtraction: 'client'), we inline the full payload
  const _PAYLOAD_INLINE = !_PAYLOAD_EXTRACTION || NUXT_PAYLOAD_INLINE

  const isRenderingPayload = (_PAYLOAD_EXTRACTION || (import.meta.dev && routeOptions.prerender)) && PAYLOAD_URL_RE.test(ssrContext.url)
  if (isRenderingPayload) {
    const url = ssrContext.url.substring(0, ssrContext.url.lastIndexOf('/')) || '/'
    ssrContext.url = url

    if (import.meta.prerender && await payloadCache!.hasItem(url + '.json')) {
      return returnResponse(event, await payloadCache!.getItem(url + '.json') as Partial<RenderResponse>)
    }
  }

  const payloadURL = _PAYLOAD_EXTRACTION ? joinURL(ssrContext.runtimeConfig.app.cdnURL || ssrContext.runtimeConfig.app.baseURL, ssrContext.url.replace(/\?.*$/, ''), PAYLOAD_FILENAME) + '?' + ssrContext.runtimeConfig.app.buildId : undefined

  // Render app
  const renderer = await getRenderer(ssrContext)

  // Render 103 Early Hints
  if (NUXT_EARLY_HINTS && !isRenderingPayload && !import.meta.prerender) {
    const { link } = renderResourceHeaders({}, renderer.rendererContext)
    if (link) {
      writeEarlyHints(event, { link })
    }
  }

  if (NUXT_INLINE_STYLES) {
    for (const id of entryIds) {
      ssrContext.modules!.add(id)
    }
  }

  // === SSR Streaming Path ===
  if (NUXT_SSR_STREAMING
    && !ssrContext.noSSR
    && !ssrError
    && !isRenderingPayload
    && !import.meta.prerender
    && (routeOptions as { streaming?: boolean }).streaming !== false
    && !SSR_BOT_RE!.test(event.req.headers.get('user-agent') || '')) {
    return renderStreamedResponse({ event, ssrContext, renderer, routeOptions, ssrError, _PAYLOAD_EXTRACTION: _PAYLOAD_EXTRACTION!, _PAYLOAD_INLINE, payloadURL })
  }

  const _rendered = await renderer.renderToString(ssrContext).catch(async (error) => {
    // We use error to bypass full render if we have an early response we can make
    if (ssrContext['~renderResponse'] && error.message === 'skipping render') { return {} as ReturnType<typeof renderer['renderToString']> }

    // Use explicitly thrown error in preference to subsequent rendering errors
    const _err = (!ssrError && ssrContext.payload?.error) || error
    await ssrContext.nuxt?.hooks.callHook('app:error', _err)
    throw _err
  })

  // Render inline styles
  const inlinedStyles = NUXT_INLINE_STYLES && !ssrContext['~renderResponse'] && !isRenderingPayload
    ? await renderInlineStyles(ssrContext.modules ?? [])
    : []

  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult: _rendered })

  if (ssrContext['~renderResponse']) {
    return returnResponse(event, ssrContext['~renderResponse'])
  }

  // Handle errors
  if (ssrContext.payload?.error && !ssrError) {
    throw ssrContext.payload.error
  }

  // Directly render payload routes
  if (isRenderingPayload) {
    const response = renderPayloadResponse(ssrContext)
    if (import.meta.prerender) {
      await payloadCache!.setItem(ssrContext.url + '.json', response)
    }

    return returnResponse(event, response)
  }

  if (_PAYLOAD_EXTRACTION && import.meta.prerender) {
    // Hint nitro to prerender payload for this route
    event.res.headers.append('x-nitro-prerender', joinURL(ssrContext.url.replace(/\?.*$/, ''), PAYLOAD_FILENAME))
    // Use same ssr context to generate payload for this route
    await payloadCache!.setItem((ssrContext.url === '/' ? '/' : ssrContext.url.replace(/\/$/, '')) + '.json', renderPayloadResponse(ssrContext))
  }

  const NO_SCRIPTS = NUXT_NO_SCRIPTS || !!routeOptions?.noScripts

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
        path = relative(event.url.pathname.replace(/\/[^/]+$/, '/'), joinURL('/', path))
        if (!/^(?:\/|\.+\/)/.test(path)) {
          path = `./${path}`
        }
      }
    }
    ssrContext.head.push({
      script: [{
        tagPosition: 'head',
        tagPriority: 'critical',
        type: 'importmap',
        // unhead v3 JSON-stringifies object innerHTML for <script> tags
        innerHTML: { imports: { '#entry': path } },
      }],
    })
  }
  // 1. Preload payloads and app manifest
  // Skip preload when inlining full payload in HTML (no separate fetch needed for initial load)
  if (_PAYLOAD_EXTRACTION && !_PAYLOAD_INLINE && !NO_SCRIPTS) {
    ssrContext.head.push({
      link: [
        { rel: 'preload', as: 'fetch', crossorigin: 'anonymous', href: payloadURL },
      ],
    })
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
      script: _PAYLOAD_INLINE
        // Inline full payload in HTML (payloadExtraction: 'client' | false, or non-cached route)
        ? renderPayloadJsonScript({ ssrContext, data: ssrContext.payload })
        // Split payload: inline initial data, reference external _payload.json via src (payloadExtraction: true)
        : renderPayloadJsonScript({ ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL }),
    }, {
      // this should come before another end of body scripts
      tagPosition: 'bodyClose',
      tagPriority: 'high',
    })
  }

  // 6. Scripts
  if (!NO_SCRIPTS) {
    ssrContext.head.push({
      script: Object.values(scripts).map(resource => (<Script> {
        type: resource.module ? 'module' : null,
        src: renderer.rendererContext.buildAssetsURL(resource.file),
        defer: resource.module ? null : true,
        // if we are rendering script tag payloads that import an async payload
        // we need to ensure this resolves before executing the Nuxt entry
        tagPosition: 'head',
        crossorigin: '',
      })),
    })
  }

  // TODO: migrate to `ssrContext.head.render()` once `renderSSRHeadOptions` (e.g. `omitLineBreaks`) can be passed to `createServerHead` at construction time.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = renderSSRHead(ssrContext.head, renderSSRHeadOptions)

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
  await useNitroHooks().callHook('render:html', htmlContext, { event })

  event.res.headers.set('content-type', 'text/html;charset=utf-8')
  event.res.headers.set('x-powered-by', 'Nuxt')

  return renderHTMLDocument(htmlContext)
}

export default handler

async function renderStreamedResponse (ctx: {
  event: H3Event
  ssrContext: NuxtSSRContext
  renderer: Awaited<ReturnType<typeof getRenderer>>
  routeOptions: ReturnType<typeof getRouteRules>['routeRules']
  ssrError: (NuxtPayload['error'] & { url: string }) | null
  _PAYLOAD_EXTRACTION: boolean
  _PAYLOAD_INLINE: boolean
  payloadURL: string | undefined
}): Promise<ReadableStream<Uint8Array>> {
  const { event, ssrContext, renderer, routeOptions, ssrError, _PAYLOAD_EXTRACTION, _PAYLOAD_INLINE, payloadURL } = ctx
  const NO_SCRIPTS = NUXT_NO_SCRIPTS || !!routeOptions?.noScripts

  // 1. Set HTTP Link headers with entry-point preload hints (fastest resource hinting)
  const { link: linkHeader } = renderResourceHeaders({}, renderer.rendererContext)
  if (linkHeader) {
    event.res.headers.append('link', linkHeader)
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
        path = relative(event.url.pathname.replace(/\/[^/]+$/, '/'), joinURL('/', path))
        if (!/^(?:\/|\.+\/)/.test(path)) { path = `./${path}` }
      }
    }
    ssrContext.head.push({
      script: [{
        tagPosition: 'head',
        tagPriority: 'critical',
        type: 'importmap',
        // unhead v3 JSON-stringifies object innerHTML for <script> tags
        innerHTML: { imports: { '#entry': path } },
      }],
    })
  }

  // Payload preload links
  if (_PAYLOAD_EXTRACTION && !_PAYLOAD_INLINE && !NO_SCRIPTS) {
    ssrContext.head.push({
      link: [
        { rel: 'preload', as: 'fetch', crossorigin: 'anonymous', href: payloadURL },
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
  if (!NO_SCRIPTS) {
    ssrContext.head.push({
      script: Object.values(entryScripts).map(resource => (<Script> {
        type: resource.module ? 'module' : null,
        src: renderer.rendererContext.buildAssetsURL(resource.file),
        defer: resource.module ? null : true,
        tagPosition: 'head',
        crossorigin: '',
      })),
    })
  }

  // Preload streaming IIFE script (production only - in dev we inline it)
  if (!NO_SCRIPTS && !import.meta.dev && iifeChunkFileName) {
    ssrContext.head.push({
      link: [{ rel: 'preload', as: 'script', href: buildAssetsURL(iifeChunkFileName) }],
    })
  }

  // 4. Render the shell head (atomically renders and clears entries)
  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = renderShell(ssrContext.head)

  // 5. Build the HTML shell
  // Bootstrap queue goes in <head> (no DOM access needed).
  // IIFE goes after <body> opens so document.body exists when it initializes the DOM renderer.
  const bootstrapScript = NO_SCRIPTS ? '' : createBootstrapScript()
  let iifeScript = ''
  if (!NO_SCRIPTS) {
    if (!import.meta.dev && iifeChunkFileName) {
      // Production: async load the built, minified IIFE chunk (bootstrap queue buffers until ready)
      iifeScript = `<script async src="${buildAssetsURL(iifeChunkFileName)}"></script>`
    } else {
      // Dev: inline the IIFE code (Vite dev server transforms to ESM so script src won't work)
      iifeScript = `<script>${streamingIifeCode}</script>`
    }
  }
  const shellHtml = '<!DOCTYPE html>'
    + `<html${htmlAttrs ? ' ' + htmlAttrs : ''}>`
    + `<head>${bootstrapScript}${headTags}</head>`
    + `<body${bodyAttrs ? ' ' + bodyAttrs : ''}>`
    + iifeScript
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
              controller.enqueue(encoder.encode(`<script>${headChunk};document.currentScript.remove()</script>`))
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
            script: _PAYLOAD_INLINE
              ? renderPayloadJsonScript({ ssrContext, data: ssrContext.payload })
              : renderPayloadJsonScript({ ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL }),
          }, {
            tagPosition: 'bodyClose',
            tagPriority: 'high',
          })
        }

        // Render any final head updates (payload scripts, etc.)
        const closingHead = applyRenderOptions(ssrContext.head.render(), renderSSRHeadOptions)

        // Call render:html hook with partial context (body is already streamed)
        const htmlContext: NuxtRenderHTMLContext = {
          htmlAttrs: [],
          head: [],
          bodyAttrs: [],
          bodyPrepend: [],
          body: [], // body was already streamed
          bodyAppend: normalizeChunks([bodyTags, closingHead.bodyTags]),
        }
        await useNitroHooks().callHook('render:html', htmlContext, { event })

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

  event.res.headers.set('content-type', 'text/html;charset=utf-8')
  event.res.headers.set('x-powered-by', 'Nuxt')

  return outputStream
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

// Applies Nuxt's `renderSSRHeadOptions` to the output of `head.render()`.
// Unhead v3 bakes render options into `createHead`, but `omitLineBreaks` is
// not currently a `createHead` option, so we apply it here post-render.
// Line breaks only separate tags (never appear inside them), so a direct
// replacement is safe.
function applyRenderOptions (payload: SSRHeadPayload, options: { omitLineBreaks?: boolean }): SSRHeadPayload {
  if (!options.omitLineBreaks) { return payload }
  return {
    headTags: payload.headTags.replaceAll('\n', ''),
    bodyTags: payload.bodyTags.replaceAll('\n', ''),
    bodyTagsOpen: payload.bodyTagsOpen.replaceAll('\n', ''),
    htmlAttrs: payload.htmlAttrs,
    bodyAttrs: payload.bodyAttrs,
  }
}

declare module 'srvx' {
  interface ServerRequestContext {
    nuxt?: {
      'appConfig'?: AppConfig
      'noSSR'?: boolean
      /** @internal */
      '~internal'?: boolean
      /** @internal */
      '~rendering-error'?: boolean
    }
  }
}

function returnResponse (event: H3Event, response: Partial<RenderResponse>) {
  for (const header in response.headers || {}) {
    event.res.headers.set(header, response.headers![header]!)
  }
  if (response.status) {
    event.res.status = response.status
  }
  if (response.statusText) {
    event.res.statusText = response.statusText
  }

  return response.body
}
