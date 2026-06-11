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
import { traceAsync } from '#app/internal/tracing'

import { APP_ROOT_CLOSE_TAG, APP_ROOT_OPEN_TAG, getRenderer, getServerApp } from '../utils/renderer/build-files'
import { payloadCache, prerenderRenderingURLs } from '../utils/cache'

import { renderPayloadJsonScript, renderPayloadResponse, splitPayload } from '../utils/renderer/payload'
import { createSSRContext, setSSRError } from '../utils/renderer/app'
import { renderInlineStyles } from '../utils/renderer/inline-styles'
import { renderStreamedIslandTeleports, replaceIslandTeleports } from '../utils/renderer/islands'
// @ts-expect-error virtual file
import { renderSSRHeadOptions } from '#internal/unhead.config.mjs'
// @ts-expect-error virtual file
import { NUXT_ASYNC_CONTEXT, NUXT_EARLY_HINTS, NUXT_INLINE_STYLES, NUXT_NO_SCRIPTS, NUXT_PAYLOAD_EXTRACTION, NUXT_PAYLOAD_INLINE, NUXT_RUNTIME_PAYLOAD_EXTRACTION, NUXT_SSR_STREAMING, NUXT_SSR_STREAMING_BOT_RE, PARSE_ERROR_DATA } from '#internal/nuxt/nitro-config.mjs'
// @ts-expect-error virtual file
import { appHead, appTeleportAttrs, appTeleportTag, componentIslands, componentIslandsActive, tracingChannelNuxt } from '#internal/nuxt.config.mjs'
// @ts-expect-error virtual file
import entryIds from '#internal/nuxt/entry-ids.mjs'
// @ts-expect-error virtual file
import { entryFileName } from '#internal/entry-chunk.mjs'
// @ts-expect-error virtual file
import { iifeChunkFileName } from '#internal/streaming-iife-chunk.mjs'
import { buildAssetsURL, publicAssetsURL } from '../utils/paths'
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

// Bot detection regex for SSR streaming.
const SSR_BOT_RE: RegExp = NUXT_SSR_STREAMING_BOT_RE

const handler: ReturnType<typeof defineEventHandler> = defineEventHandler((event) => {
  // Whether we're rendering an error page
  const ssrError = event.url.pathname.startsWith('/__nuxt_error')
    ? getQuery<NuxtPayload['error'] & { url: string }>(event)
    : null

  if (ssrError && !event.context.nuxt?.['~rendering-error'] /* allow internal fetch from the error handler */) {
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

  // `render:route` lets modules influence streaming via `canStream` (read-only
  // hard gate) and `prefersStream` (mutable soft preference); streaming happens
  // only when both hold.
  const canStream = NUXT_SSR_STREAMING
    && !ssrContext.noSSR
    && !ssrError
    && !isRenderingPayload
    && !import.meta.prerender
    // Island teleports relocate client-side; without scripts there is no
    // relocation, so island apps must fall back to buffered rendering.
    && !(NUXT_NO_SCRIPTS && componentIslandsActive)
    && !routeOptions.noScripts
    && !!routeOptions.streaming
    && !routeOptions.cache
    && !routeOptions.isr
    && !routeOptions.redirect

  const renderRouteContext = {
    canStream,
    prefersStream: !!(NUXT_SSR_STREAMING
      && !SSR_BOT_RE.test(event.req.headers.get('user-agent') || '')),
  }
  const nitroHooks = useNitroHooks()
  const renderRouteResult = nitroHooks.callHook('render:route', renderRouteContext, { event })
  if (renderRouteResult instanceof Promise) { await renderRouteResult }

  if (NUXT_SSR_STREAMING && canStream && renderRouteContext.prefersStream) {
    const streamArgs = { event, ssrContext, renderer, routeOptions, ssrError, _PAYLOAD_EXTRACTION: _PAYLOAD_EXTRACTION!, _PAYLOAD_INLINE, payloadURL }
    return tracingChannelNuxt
      ? traceAsync('nuxt.render', { event, ssrContext, streaming: true }, () => renderStreamedResponse(streamArgs))
      : renderStreamedResponse(streamArgs)
  }

  const _rendered = await (tracingChannelNuxt
    ? traceAsync('nuxt.render', { event, ssrContext, streaming: false }, () => renderer.renderToString(ssrContext))
    : renderer.renderToString(ssrContext)
  ).catch(async (error) => {
    // We use error to bypass full render if we have an early response we can make
    if (ssrContext['~renderResponse'] && error.message === 'skipping render') { return {} as ReturnType<typeof renderer['renderToString']> }

    // Use explicitly thrown error in preference to subsequent rendering errors
    const _err = (!ssrError && ssrContext.payload?.error) || error
    const r = ssrContext.nuxt?.hooks.callHook('app:error', _err)
    if (r instanceof Promise) { await r }
    throw _err
  })

  // Render inline styles
  const inlinedStyles = NUXT_INLINE_STYLES && !ssrContext['~renderResponse'] && !isRenderingPayload
    ? await renderInlineStyles(ssrContext.modules ?? [])
    : []

  const appRenderedResult = ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult: _rendered })
  if (appRenderedResult instanceof Promise) { await appRenderedResult }

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
    // (CSS links are already added above, this only affects JS preloads).
    // `_requestDependencies` is the per-request cache used by `getRequestDependencies`
    // in vue-bundle-renderer; we drop it here to force the preload/prefetch calls below
    // to recompute against the pruned modules.
    if (ssrContext['~lazyHydratedModules']?.size) {
      for (const id of ssrContext['~lazyHydratedModules']) {
        ssrContext.modules?.delete(id)
      }
      ssrContext._requestDependencies = undefined
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
        // `prefetchLinks` is only consumed when *another* page prefetches this URL via
        // _payload.json, so we drop it from the inline payload to avoid the duplication.
        ? renderPayloadJsonScript({ ssrContext, data: stripInlineOnlyPayloadFields(ssrContext.payload) })
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
  const renderHtmlResult = nitroHooks.callHook('render:html', htmlContext, { event })
  if (renderHtmlResult instanceof Promise) { await renderHtmlResult }

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
}): Promise<ReadableStream<Uint8Array> | RenderResponse['body']> {
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

  // 4. Create the Vue app FIRST so plugins (which push critical resource
  // hints, fonts, etc. via `useHead`) get their entries into `ssrContext.head`
  // before we consume them for the shell. `createSSRApp` runs plugins and
  // middleware: `navigateTo()` from plugins/middleware throws `skipping
  // render` here, which we catch before committing any bytes.
  const createSSRApp = await getServerApp()
  let vueApp
  try {
    vueApp = await createSSRApp(ssrContext)
  } catch (error: any) {
    if (ssrContext['~renderResponse'] && error?.message === 'skipping render') {
      // Drop any preload `Link` header that targeted the streamed entry - the
      // redirect/response we are about to send does not need them.
      event.res.headers.delete('link')
      return returnResponse(event, ssrContext['~renderResponse'])
    }
    const r = ssrContext.nuxt?.hooks.callHook('app:error', error)
    if (r instanceof Promise) { await r }
    throw error
  }
  if (ssrContext['~renderResponse']) {
    event.res.headers.delete('link')
    return returnResponse(event, ssrContext['~renderResponse'])
  }

  // 5. Render the shell head (atomically renders and clears entries pushed
  // by both the shell-prep section above and the just-completed plugin phase).
  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = renderShell(ssrContext.head)

  // CSP nonce: streaming emits several inline `<script>`s that bypass unhead
  // (bootstrap queue, IIFE, mid-stream head-push chunks, island relocation), so
  // a strict `script-src 'nonce-…'` policy would block them. Reuse whatever
  // nonce a security module stamped onto the rendered head scripts; if none is
  // present the attribute is omitted and behaviour is unchanged.
  const cspNonce = headTags.match(/<script[^>]+\bnonce="([^"]*)"/)?.[1]
  const nonceAttr = cspNonce ? ` nonce="${cspNonce}"` : ''

  // 6. Build the HTML shell context and fire `render:html` with `streaming: true`.
  // Modules that mutate `htmlAttrs`/`head`/`bodyAttrs`/`bodyPrepend` see their
  // changes land in the shell. `body`/`bodyAppend` mutations are silently
  // dropped (the body is about to stream), and a dev warning is emitted if
  // either array is touched.
  const bootstrapScript = NO_SCRIPTS ? '' : createBootstrapScript(undefined, cspNonce)
  let iifeScript = ''
  if (!NO_SCRIPTS) {
    if (!import.meta.dev && iifeChunkFileName) {
      iifeScript = `<script async${nonceAttr} src="${buildAssetsURL(iifeChunkFileName)}"></script>`
    } else {
      iifeScript = `<script${nonceAttr}>${streamingIifeCode}</script>`
    }
  }
  const shellContext: NuxtRenderHTMLContext = {
    htmlAttrs: htmlAttrs ? [htmlAttrs] : [],
    head: normalizeChunks([bootstrapScript, headTags]),
    bodyAttrs: bodyAttrs ? [bodyAttrs] : [],
    bodyPrepend: normalizeChunks([iifeScript, bodyTagsOpen]),
    body: [],
    bodyAppend: [],
  }
  const nitroHooks = useNitroHooks()
  if (import.meta.dev) {
    const initialBodyLen = shellContext.body.length
    const initialAppendLen = shellContext.bodyAppend.length
    const r = nitroHooks.callHook('render:html', shellContext, { event, streaming: true })
    if (r instanceof Promise) { await r }
    if (shellContext.body.length !== initialBodyLen || shellContext.bodyAppend.length !== initialAppendLen) {
      console.warn(`[nuxt] \`render:html\` mutated \`body\`/\`bodyAppend\` while streaming (${event.url.pathname}). These fields are silently dropped because the body is about to stream - use the \`render:html:close\` hook instead.`)
    }
  } else {
    const r = nitroHooks.callHook('render:html', shellContext, { event, streaming: true })
    if (r instanceof Promise) { await r }
  }

  const shellHtml = '<!DOCTYPE html>'
    + `<html${joinAttrs(shellContext.htmlAttrs)}>`
    + `<head>${joinTags(shellContext.head)}</head>`
    + `<body${joinAttrs(shellContext.bodyAttrs)}>`
    + joinTags(shellContext.bodyPrepend)

  // 7. Create the Vue stream
  const vueStream = renderToWebStream(vueApp, ssrContext)
  const reader = vueStream.getReader()

  // Pre-read the first chunk before committing any bytes. Three things can
  // surface here that must short-circuit streaming, since once the shell is
  // on the wire the response status is committed:
  //   1. `navigateTo()` from a page `<script setup>` sets `~renderResponse`
  //      during Vue's setup phase - we must return that redirect instead.
  //   2. Fatal errors thrown during initial render - fall through to the
  //      buffered error renderer.
  //   3. `createError({ fatal: true })` populates `payload.error` without
  //      throwing - same as above.
  let firstChunk: Uint8Array | undefined
  try {
    const { done, value } = await reader.read()
    if (!done) { firstChunk = value }
  } catch (error) {
    reader.releaseLock()
    event.res.headers.delete('link')
    if (ssrContext['~renderResponse']) {
      return returnResponse(event, ssrContext['~renderResponse'])
    }
    const _err = (!ssrError && ssrContext.payload?.error) || error
    const r = ssrContext.nuxt?.hooks.callHook('app:error', _err)
    if (r instanceof Promise) { await r }
    throw _err
  }

  if (ssrContext['~renderResponse']) {
    reader.cancel().catch(() => {})
    event.res.headers.delete('link')
    return returnResponse(event, ssrContext['~renderResponse'])
  }

  if (ssrContext.payload?.error && !ssrError) {
    reader.cancel().catch(() => {})
    event.res.headers.delete('link')
    throw ssrContext.payload.error
  }

  // Snapshot status + headers before shell commit so we can warn in dev when
  // composables like `useCookie`, `setResponseStatus`, or `useResponseHeader`
  // mutate the response after the wire is closed. These mutations are
  // silently lost in production - the warning is dev-only diagnostic.
  const committedSnapshot = import.meta.dev
    ? {
        status: event.res.status,
        statusText: event.res.statusText,
        headers: Array.from(event.res.headers.entries()).sort().map(([k, v]) => `${k}: ${v}`).join('\n'),
      }
    : null

  // 8. Build the streaming response
  const encoder = new TextEncoder()
  let chunkIndex = 0
  // `enqueueChunk` runs `render:html:chunk` per chunk so listeners can mutate
  // bytes (e.g. CSP nonce injection). Hook implementations should stay
  // synchronous to preserve the TTFB gains.
  const enqueueChunk = (controller: ReadableStreamDefaultController<Uint8Array>, chunk: Uint8Array): void | Promise<void> => {
    const chunkContext = { chunk, index: chunkIndex++ }
    const result = nitroHooks.callHook('render:html:chunk', chunkContext, { event })
    if (result instanceof Promise) {
      return result.then(() => { controller.enqueue(chunkContext.chunk) })
    }
    controller.enqueue(chunkContext.chunk)
  }
  // Route/layout styles. The shell was flushed before render, so it only
  // carries entry-chunk styles; once render has registered the page, layout
  // and (later) async-component modules we emit their styles too - inlined as
  // `<style>` when `inlineStyles` is on (matching the buffered path), otherwise
  // as stylesheet links. They sit after the shell and outside `#__nuxt`, so the
  // browser applies them without a hydration mismatch. Deduped against the
  // entry styles and across calls.
  const emittedStyles = new Set<string>(Object.values(entryStyles).map(r => r.file))
  const inlinedCss = new Set<string>(entryInlineStyles.map(s => String(s.innerHTML)))
  const renderRouteStyles = async (): Promise<string> => {
    let tags = ''
    if (NUXT_INLINE_STYLES) {
      for (const style of await renderInlineStyles(ssrContext.modules ?? [])) {
        const css = String(style.innerHTML)
        if (!css || inlinedCss.has(css)) { continue }
        inlinedCss.add(css)
        tags += `<style${nonceAttr}>${css}</style>`
      }
      return tags
    }
    for (const resource of Object.values(getRequestDependencies(ssrContext, renderer.rendererContext).styles)) {
      if (emittedStyles.has(resource.file)) { continue }
      if (import.meta.dev && 'inline' in getURLQuery(resource.file)) { continue }
      emittedStyles.add(resource.file)
      tags += `<link rel="stylesheet" crossorigin href="${renderer.rendererContext.buildAssetsURL(resource.file)}">`
    }
    return tags
  }

  const outputStream = new ReadableStream<Uint8Array>({
    async start (controller) {
      try {
        // Flush the shell immediately - fastest TTFB is the whole point. Route
        // assets are computed *after* this enqueue so resolving inline styles
        // never delays the shell, then sent before the app root opens.
        await enqueueChunk(controller, encoder.encode(shellHtml))
        await enqueueChunk(controller, encoder.encode((await renderRouteStyles()) + APP_ROOT_OPEN_TAG))
        if (firstChunk) {
          await enqueueChunk(controller, firstChunk)
          const headChunk = renderSSRHeadSuspenseChunk(ssrContext.head)
          if (headChunk && !NO_SCRIPTS) {
            await enqueueChunk(controller, encoder.encode(`<script${nonceAttr}>${headChunk};document.currentScript.remove()</script>`))
          }
        }

        // Pipe the rest of the Vue stream, injecting head suspense chunks
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) { break }
            await enqueueChunk(controller, value)

            // Inject head updates from resolved suspense boundaries
            const headChunk = renderSSRHeadSuspenseChunk(ssrContext.head)
            if (headChunk && !NO_SCRIPTS) {
              await enqueueChunk(controller, encoder.encode(`<script${nonceAttr}>${headChunk};document.currentScript.remove()</script>`))
            }
          }
        } finally {
          reader.releaseLock()
        }

        // Final head flush - entries pushed after the last suspense boundary
        // resolves (e.g. `bodyClose` scripts via `onPrehydrate`) would otherwise
        // bypass the streaming push pipeline and land as static tags in `</body>`.
        if (!NO_SCRIPTS) {
          const finalHeadChunk = renderSSRHeadSuspenseChunk(ssrContext.head)
          if (finalHeadChunk) {
            await enqueueChunk(controller, encoder.encode(`<script${nonceAttr}>${finalHeadChunk};document.currentScript.remove()</script>`))
          }
        }

        // Stream complete: build closing HTML
        const appRenderedResult = ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult: {} as any })
        if (appRenderedResult instanceof Promise) { await appRenderedResult }

        // The HTTP status is already committed (200), so an error here can
        // only reach the client via the payload - the client renders the
        // error page during hydration.
        if (ssrContext.payload?.error && !ssrError) {
          const r = ssrContext.nuxt?.hooks.callHook('app:error', ssrContext.payload.error)
          if (r instanceof Promise) { await r }
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

        // Render any final head updates (payload scripts, etc.) and fire the
        // streaming `render:html:close` hook so modules can inject final
        // bodyAppend content (analytics tags, end-of-body scripts, etc.).
        const closingHead = applyRenderOptions(ssrContext.head.render(), renderSSRHeadOptions)
        const closeContext = { bodyAppend: normalizeChunks([bodyTags, closingHead.bodyTags]) }
        const closeResult = nitroHooks.callHook('render:html:close', closeContext, { event })
        if (closeResult instanceof Promise) { await closeResult }

        // Teleports + closing tags. `teleports.body` collects content from
        // `<Teleport to="body">` and must be appended before `</body>` -
        // the buffered renderer places it at `bodyPrepend` but the body is
        // already streamed here, so the bottom-of-body position is the only
        // option for streaming.
        const teleportHtml = APP_TELEPORT_OPEN_TAG
          + (HAS_APP_TELEPORTS ? joinTags([ssrContext.teleports?.[`#${appTeleportAttrs.id}`]]) : '')
          + APP_TELEPORT_CLOSE_TAG

        // Island teleports (slot content, selective-client components) cannot
        // be stitched into the body string - it has already streamed. Emit them
        // as inert `<template>`s plus a relocation script that runs before the
        // deferred entry hydrates. Skipped under `NO_SCRIPTS` (the guard keeps
        // island apps buffered in that case).
        const islandTeleports = NO_SCRIPTS ? '' : renderStreamedIslandTeleports(ssrContext, nonceAttr)

        const closingHtml = APP_ROOT_CLOSE_TAG
          // Styles for modules registered after the first chunk (deeply nested
          // async components) - emitted outside the app root.
          + (await renderRouteStyles())
          + teleportHtml
          + (ssrContext.teleports?.body || '')
          + islandTeleports
          + joinTags(closeContext.bodyAppend)
          + '</body></html>'

        await enqueueChunk(controller, encoder.encode(closingHtml))
        controller.close()

        if (committedSnapshot) {
          const currentHeaders = Array.from(event.res.headers.entries()).sort().map(([k, v]) => `${k}: ${v}`).join('\n')
          const lateMutations: string[] = []
          if (event.res.status !== committedSnapshot.status) {
            lateMutations.push(`response status changed from ${committedSnapshot.status || 200} to ${event.res.status} (e.g. \`setResponseStatus\`)`)
          }
          if (event.res.statusText !== committedSnapshot.statusText) {
            lateMutations.push(`response statusText changed (e.g. \`setResponseStatus\`)`)
          }
          if (currentHeaders !== committedSnapshot.headers) {
            lateMutations.push(`response headers changed during render (e.g. \`useCookie\`, \`useResponseHeader\`, \`setHeader\`)`)
          }
          if (lateMutations.length) {
            console.warn(
              `[nuxt] SSR streaming committed the response before render completed. The following mutations did not reach the client and were dropped:\n  - ${lateMutations.join('\n  - ')}\n  Path: ${event.url.pathname}\n  Move the mutation into a plugin (which runs before the shell is flushed), or opt this route out of streaming with \`routeRules: { '${event.url.pathname}': { streaming: false } }\` or the \`render:route\` hook.`,
            )
          }
        }
      } catch (error) {
        // Status code is already committed (200) because the shell flushed
        // before this error was thrown. The browser can only learn about the
        // error via hydration - set `payload.error` so the client renders
        // the error page once it picks up the SSR data, then emit a
        // well-formed closing so HTML parsing doesn't choke.
        await Promise.resolve(ssrContext.nuxt?.hooks.callHook('app:error', error)).catch(() => {})
        ssrContext.payload ||= {} as NuxtPayload
        ssrContext.payload.error ||= error as any
        try {
          if (!NO_SCRIPTS) {
            ssrContext.head.push({
              script: renderPayloadJsonScript({ ssrContext, data: ssrContext.payload }),
            }, { tagPosition: 'bodyClose', tagPriority: 'high' })
            const tail = applyRenderOptions(ssrContext.head.render(), renderSSRHeadOptions)
            controller.enqueue(encoder.encode(tail.bodyTags))
          }
        } catch {
          // best-effort
        }
        controller.enqueue(encoder.encode(APP_ROOT_CLOSE_TAG + '</body></html>'))
        controller.close()
      }
    },
    cancel (reason) {
      // Client disconnected (or downstream cancelled). Stop Vue from rendering,
      // otherwise it keeps walking the component tree until completion,
      // burning CPU/memory on abandoned requests.
      reader.cancel(reason).catch(() => {})
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

interface NuxtRequestContext {
  'appConfig'?: AppConfig
  'noSSR'?: boolean
  /** @internal */
  '~internal'?: boolean
  /** @internal */
  '~rendering-error'?: boolean
}

declare module 'srvx' {
  interface ServerRequestContext {
    nuxt?: NuxtRequestContext
  }
}

declare module 'h3' {
  interface H3EventContext {
    nuxt?: NuxtRequestContext
  }
}

function stripInlineOnlyPayloadFields (payload: NuxtSSRContext['payload']): NuxtSSRContext['payload'] {
  if (!payload.prefetchLinks) { return payload }
  const { prefetchLinks: _, ...rest } = payload
  return rest
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
