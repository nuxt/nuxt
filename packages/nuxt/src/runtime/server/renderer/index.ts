import { getPrefetchLinks, getPreloadLinks, getRequestDependencies, renderResourceHeaders } from 'vue-bundle-renderer/runtime'
import { joinURL } from 'ufo'
import { renderSSRHead } from '@unhead/vue/server'
import type { Link } from '@unhead/vue/types'

import { SSR_ERROR_PARAM, decodeSSRError, stringifyErrorData } from './error'
import type { SSRError } from './error'

import type { NuxtRenderDocumentContext, NuxtRenderHTMLContext, NuxtSSRContext, SerializedErrorCause } from '#app/types'
import { traceAsync } from '../../../app/internal/tracing'

import { renderPayloadResponse } from './payload'
import { createSSRContext, rethrowWithResponseHeaders, returnRenderResponse, setSSRError } from './app'
import { patchDevClientCss } from './dev-css'
import { renderSplitInlineStyles } from './inline-styles'
import { createInlinedCSSFilter } from './inlined-css'
import { throwIfUnmatchedPagePath, toPageMatcherPath } from './early-404'
import { replaceIslandTeleports } from './islands'
import { warnNoScriptsClientReliance } from './no-scripts'
import { PAYLOAD_FILENAME, payloadRequestToRoute, routeToPayloadURL } from './url'
import { addPrerenderRoutes, appEvent, getRequestState } from './runtime'
import { createRendererInstance } from './instance'
import type { NuxtRendererInstance } from './instance'
import type { NuxtRendererOptions, RendererEvent } from './runtime'
import { getPrerenderedErrorPage, isPrerenderedErrorPage, renderErrorResponse } from './error-page'
import { normalizeChunks, renderAppTeleports, renderDevBadge, renderHTMLDocument, renderHTMLDocumentChunks } from './document'
import { inertPrefetchLink, inlinesStyles, isDevInlineStyle, pushEntryImportMap, pushEntryScripts, pushNoScriptsHints, pushPayloadPreload, pushPayloadScript } from './head'
import { renderStreamedResponse } from './stream'
import { NUXT_DEFER_PREFETCH_HINTS, NUXT_EARLY_404, NUXT_EARLY_HINTS, NUXT_INLINE_ERROR_RENDERING, NUXT_INLINE_STYLES, NUXT_NO_SCRIPTS, NUXT_NO_SCRIPTS_PROD, NUXT_PAYLOAD_EXTRACTION, NUXT_PAYLOAD_INLINE, NUXT_PRERENDER_NO_SSR_ROUTES, NUXT_RUNTIME_PAYLOAD_EXTRACTION, NUXT_SPA_PAGE_MATCHER, NUXT_SSR_STREAMING, NUXT_SSR_STREAMING_BOT_RE, PARSE_ERROR_DATA, appHead, componentIslands, componentIslandsActive, renderSSRHeadOptions, tracingChannelNuxt } from 'nuxt/internal/renderer-config'
import entryIds from 'nuxt/internal/entry-ids'
import { entryFileName } from 'nuxt/internal/entry-chunk'

export type { NuxtRendererOptions, RendererEvent, RendererHooks, RendererRouteRules, CachedResponse, PayloadCache, NuxtRequestState } from './runtime'
export { appEvent } from './runtime'

const PAYLOAD_URL_RE = /^[^?]*\/_payload.json(?:\?.*)?$/

/**
 * Create a Nuxt SSR renderer, returning a web-standard handler for the requests a Nuxt
 * app serves from its pages.
 *
 * Everything the renderer reads belongs to the renderer it was created for, so a bundle
 * may create as many as it needs. Pass an instance from `createRendererInstance()` to
 * render against the artifacts already loaded for another renderer.
 */
export function createNuxtRenderer (optionsOrInstance: NuxtRendererOptions | NuxtRendererInstance): { fetch: (event: RendererEvent) => Promise<Response> } {
  const instance = 'getRenderer' in optionsOrInstance ? optionsOrInstance : createRendererInstance(optionsOrInstance)
  return {
    fetch: tracingChannelNuxt
      ? event => traceAsync('nuxt.request', { event: appEvent(event) }, () => fetch(instance, event))
      : event => fetch(instance, event),
  }
}

function fetch (instance: NuxtRendererInstance, event: RendererEvent): Promise<Response> {
  const runtime = instance.options

  if (componentIslands && runtime.renderIsland && event.url.pathname.startsWith('/__nuxt_island/')) {
    return Promise.resolve(runtime.renderIsland(event))
  }

  const isErrorRoute = event.url.pathname.startsWith('/__nuxt_error')

  // a render the runtime re-entered to build *its* error page keeps throwing back to it, as does
  // a payload render
  const inlineErrors = NUXT_INLINE_ERROR_RENDERING
    && !getRequestState(event)?.['~rendering-error']
    && !PAYLOAD_URL_RE.test(event.url.pathname)
  const renderErrorPage = (error: unknown) => renderErrorResponse(runtime, event, error, ssrError => renderRoute(instance, event, ssrError))

  // only the error handler of the runtime may render the error route
  if (isErrorRoute && !getRequestState(event)?.['~rendering-error']) {
    const error = runtime.createError({
      status: 404,
      statusText: 'Page Not Found: /__nuxt_error',
    })
    return inlineErrors ? renderErrorPage(error) : Promise.reject(error)
  }

  const ssrError = isErrorRoute
    ? decodeSSRError(event.url.searchParams.get(SSR_ERROR_PARAM) ?? undefined)
    : import.meta.prerender
      ? getPrerenderedErrorPage(event)
      : undefined

  const render = () => renderRoute(instance, event, ssrError)

  const wrapRender = import.meta.prerender ? runtime.prerender?.wrapRender : undefined
  const rendering = wrapRender ? wrapRender(event, render) : render()

  return inlineErrors
    ? rendering.catch(renderErrorPage)
    : rendering.catch(error => rethrowWithResponseHeaders(event, error))
}

async function renderRoute (instance: NuxtRendererInstance, event: RendererEvent, ssrError?: SSRError): Promise<Response> {
  const runtime = instance.options

  const ssrContext: NuxtSSRContext = createSSRContext(runtime, event)
  const hookEvent = appEvent(event)

  ssrContext.head.push(appHead)

  if (ssrError) {
    if (!PARSE_ERROR_DATA) {
      (ssrError as { data?: unknown }).data = stringifyErrorData(ssrError.data)
    }
    if (import.meta.dev && getRequestState(event)?.['~error-cause'] !== undefined) {
      (ssrError as { cause?: SerializedErrorCause }).cause = getRequestState(event)!['~error-cause'] as SerializedErrorCause
    }
    setSSRError(ssrContext, ssrError)
  }

  const routeOptions = runtime.getRouteRules(event)
  const NO_SCRIPTS = NUXT_NO_SCRIPTS || !!routeOptions.noScripts
  const DEFER_PREFETCH = NUXT_DEFER_PREFETCH_HINTS && !NO_SCRIPTS

  // an error page rendered as an empty SPA shell shows the visitor nothing
  if (!routeOptions.ssr && !ssrError) {
    ssrContext.noSSR = true
  }

  // Fail fast for paths that cannot match any page route, before the app (and
  // its plugins and middleware) is loaded. Skipped when prerendering SPA shell
  // fallbacks (`/index.html`, `/200.html`), which are not page routes.
  if (NUXT_EARLY_404 && !ssrError && !(import.meta.prerender && ssrContext.noSSR)) {
    throwIfUnmatchedPagePath(runtime, event, routeOptions)
  }

  // Whether we are prerendering route or using ISR/SWR caching
  const payloadExtraction = !ssrContext.noSSR && !ssrError && !!(
    (import.meta.prerender && NUXT_PAYLOAD_EXTRACTION)
    || (NUXT_RUNTIME_PAYLOAD_EXTRACTION && (routeOptions.isr || routeOptions.cache))
  )

  // `payloadExtraction: 'client'` inlines the full payload as well
  const payloadInline = !payloadExtraction || NUXT_PAYLOAD_INLINE

  const isRenderingPayload = (payloadExtraction || (import.meta.dev && routeOptions.prerender)) && PAYLOAD_URL_RE.test(ssrContext.url)
  if (isRenderingPayload) {
    ssrContext.url = payloadRequestToRoute(ssrContext.url)

    if (import.meta.prerender && await runtime.prerender!.payloadCache.hasItem(ssrContext.url + '.json')) {
      event.res.headers.set('content-type', 'application/json')
      const response = await runtime.prerender!.payloadCache.getItem(ssrContext.url + '.json') || undefined
      return runtime.createResponse(response?.body ?? null, response ?? undefined)
    }
  }

  const payloadURL = payloadExtraction ? buildPayloadURL(ssrContext, !import.meta.prerender && !!(routeOptions.isr || routeOptions.cache)) : undefined

  const renderer = await instance.getRenderer(ssrContext)
  const { rendererContext } = renderer

  if (import.meta.dev) {
    patchDevClientCss(event, rendererContext)
  }

  if (NUXT_EARLY_HINTS && !isRenderingPayload && !import.meta.prerender) {
    const { link } = renderResourceHeaders({}, rendererContext, { scripts: !NO_SCRIPTS, prefetch: !DEFER_PREFETCH })
    if (link) {
      runtime.writeEarlyHints?.(event, { link })
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
      && !NUXT_SSR_STREAMING_BOT_RE.test(event.req.headers.get('user-agent') || '')),
  }
  const hooks = instance.hooks
  const renderRouteResult = hooks.callHook('render:route', renderRouteContext, { event: hookEvent })
  if (renderRouteResult instanceof Promise) { await renderRouteResult }

  if (NUXT_SSR_STREAMING && canStream && renderRouteContext.prefersStream) {
    const stream = { instance, event, ssrContext, renderer, noScripts: NO_SCRIPTS, ssrError, payloadExtraction, payloadInline, payloadURL }
    return tracingChannelNuxt
      ? traceAsync('nuxt.render', { event: hookEvent, ssrContext, streaming: true }, () => renderStreamedResponse(stream))
      : renderStreamedResponse(stream)
  }

  const _rendered = await (tracingChannelNuxt
    ? traceAsync('nuxt.render', { event: hookEvent, ssrContext, streaming: false }, () => renderer.renderToString(ssrContext))
    : renderer.renderToString(ssrContext)
  ).catch(async (error) => {
    // We use error to bypass full render if we have an early response we can make
    if (ssrContext['~renderResponse'] && error.message === 'skipping render') { return {} as ReturnType<typeof renderer['renderToString']> }

    // Use explicitly thrown error in preference to subsequent rendering errors
    const _err = (!ssrError && ssrContext.payload?.error) || error
    await ssrContext.nuxt?.hooks.callHook('app:error', _err)
    throw _err
  })

  const renderedHtml = _rendered.html

  const inlineStyles = inlinesStyles(NO_SCRIPTS)
  const [entryInlinedStyles, componentInlinedStyles] = inlineStyles && !ssrContext['~renderResponse'] && !isRenderingPayload
    ? await renderSplitInlineStyles(ssrContext.modules ?? [], entryIds)
    : [[], []]

  if (import.meta.prerender && ssrError && isPrerenderedErrorPage(event.url.pathname)) {
    delete ssrContext.payload.path
    if (ssrContext.payload.error) {
      (ssrContext.payload.error as { url?: string }).url = undefined
    }
  }

  const appRenderedResult = ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult: _rendered })
  if (appRenderedResult instanceof Promise) { await appRenderedResult }

  if (ssrContext['~renderResponse']) {
    return returnRenderResponse(runtime, event, ssrContext['~renderResponse'])
  }

  if (ssrContext.payload?.error && !ssrError) {
    throw ssrContext.payload.error
  }

  if (isRenderingPayload) {
    const response = renderPayloadResponse(ssrContext, event)
    if (import.meta.prerender) {
      await runtime.prerender!.payloadCache.setItem(ssrContext.url + '.json', response)
    }

    return runtime.createResponse(response.body, response)
  }

  if (payloadExtraction && import.meta.prerender) {
    // the payload for this route is prerendered alongside it
    addPrerenderRoutes(event, joinURL(ssrContext.url.replace(/\?.*$/, ''), PAYLOAD_FILENAME))
    // Use same ssr context to generate payload for this route
    await runtime.prerender!.payloadCache.setItem((ssrContext.url === '/' ? '/' : ssrContext.url.replace(/\/$/, '')) + '.json', renderPayloadResponse(ssrContext, event))
  }

  if (import.meta.dev && !ssrError && !ssrContext.error) {
    runtime.onRenderSuccess?.(event)
  }

  if (import.meta.dev && NUXT_NO_SCRIPTS_PROD && !NO_SCRIPTS && !ssrError) {
    warnNoScriptsClientReliance(ssrContext, event.url.pathname)
  }

  const { styles, scripts } = getRequestDependencies(ssrContext, rendererContext)

  pushNoScriptsHints(ssrContext, NO_SCRIPTS)

  if (entryFileName && !NO_SCRIPTS) {
    pushEntryImportMap(instance, event, ssrContext)
  }
  // an inlined payload needs no separate fetch for the initial load
  if (payloadExtraction && !payloadInline && !NO_SCRIPTS) {
    pushPayloadPreload(ssrContext, payloadURL)
  }

  if (entryInlinedStyles.length) {
    ssrContext.head.push({ style: entryInlinedStyles })
  }

  const link: Link[] = []
  const inlinedHrefs: string[] = []
  const isCSSInlined = inlineStyles ? await createInlinedCSSFilter(ssrContext.modules) : undefined
  for (const resource of Object.values(styles)) {
    if (isDevInlineStyle(resource.file)) {
      continue
    }
    if (isCSSInlined?.(resource.file)) {
      inlinedHrefs.push(rendererContext.buildAssetsURL(resource.file))
      continue
    }
    link.push({ rel: 'stylesheet', href: rendererContext.buildAssetsURL(resource.file), crossorigin: '' })
  }

  // disabled links are not fetched, but stop the client from loading a stylesheet whose rules are inlined
  if (!NO_SCRIPTS) {
    for (const href of inlinedHrefs) {
      link.push({ rel: 'stylesheet', href, disabled: true })
    }
  }

  if (link.length) {
    ssrContext.head.push({ link })
  }

  if (componentInlinedStyles.length) {
    ssrContext.head.push({ style: componentInlinedStyles })
  }

  // Excluding lazy hydrated modules keeps their JS chunks from being preloaded, but also
  // resurfaces their CSS as hints, so filter out anything already linked as a stylesheet.
  const dependencyOptions = {
    exclude: ssrContext['~lazyHydratedModules']?.size ? ssrContext['~lazyHydratedModules'] : undefined,
    scripts: !NO_SCRIPTS,
  }
  // exclude hrefs already linked as stylesheets (or delivered as inline styles),
  // plus never-hydrated chunks which the client can never fetch
  const excludeHrefs = new Set(link.map(l => l.href))
  for (const href of inlinedHrefs) {
    excludeHrefs.add(href)
  }
  for (const resource of Object.values(scripts)) {
    excludeHrefs.add(rendererContext.buildAssetsURL(resource.file))
  }
  for (const id of ssrContext['~neverHydratedModules'] ?? []) {
    const file = (rendererContext.manifest ?? rendererContext.precomputed?.modules)?.[id]?.file
    if (file) {
      excludeHrefs.add(rendererContext.buildAssetsURL(file))
    }
  }
  const hints: Link[] = []
  let preloadContext: Pick<NuxtSSRContext, 'modules'> = ssrContext
  if (NUXT_SPA_PAGE_MATCHER && ssrContext.noSSR && !ssrError && !NO_SCRIPTS && !(import.meta.prerender && NUXT_PRERENDER_NO_SSR_ROUTES.includes(event.url.pathname))) {
    const spaPageSources = NUXT_SPA_PAGE_MATCHER('', toPageMatcherPath(event.url.pathname))?.data
    if (spaPageSources?.length) {
      preloadContext = { modules: new Set([...ssrContext.modules ?? [], ...spaPageSources]) }
      for (const resource of Object.values(getRequestDependencies(preloadContext, rendererContext).styles)) {
        const href = rendererContext.buildAssetsURL(resource.file)
        if (!excludeHrefs.has(href)) {
          hints.push({ rel: 'preload', as: 'style', crossorigin: '', href })
        }
      }
    }
  }
  for (const l of getPreloadLinks(preloadContext, rendererContext, dependencyOptions) as Link[]) {
    if (!excludeHrefs.has(l.href)) {
      hints.push(l)
    }
  }
  for (const l of getPrefetchLinks(preloadContext, rendererContext, dependencyOptions) as Link[]) {
    if (!excludeHrefs.has(l.href)) {
      hints.push(DEFER_PREFETCH ? inertPrefetchLink(l) : l)
    }
  }
  if (hints.length) {
    ssrContext.head.push({ link: hints })
  }

  if (!NO_SCRIPTS) {
    pushPayloadScript(ssrContext, payloadInline, payloadURL)
    pushEntryScripts(ssrContext, scripts, rendererContext)
  }

  // TODO: migrate to `ssrContext.head.render()` once `renderSSRHeadOptions` (e.g. `omitLineBreaks`) can be passed to `createServerHead` at construction time.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = renderSSRHead(ssrContext.head, renderSSRHeadOptions)

  const htmlContext: NuxtRenderHTMLContext = {
    htmlAttrs: htmlAttrs ? [htmlAttrs] : [],
    head: normalizeChunks([headTags, import.meta.dev ? await renderDevBadge(runtime, event, NO_SCRIPTS) : undefined]),
    bodyAttrs: bodyAttrs ? [bodyAttrs] : [],
    bodyPrepend: normalizeChunks([bodyTagsOpen, ssrContext.teleports?.body]),
    body: [
      componentIslands ? replaceIslandTeleports(ssrContext, _rendered.html) : _rendered.html,
      renderAppTeleports(ssrContext),
    ],
    bodyAppend: [bodyTags],
  }

  const renderHtmlResult = hooks.callHook('render:html', htmlContext, { event: hookEvent })
  if (renderHtmlResult instanceof Promise) { await renderHtmlResult }

  // the document is only serialised here if a listener reads it
  let documentHtml: string | undefined
  let replaced = false
  const documentContext: NuxtRenderDocumentContext = {
    get html () { return documentHtml ??= renderHTMLDocument(htmlContext) },
    set html (value) {
      documentHtml = value
      replaced = true
    },
  }
  const renderDocumentResult = hooks.callHook('render:document', documentContext, { event: hookEvent })
  if (renderDocumentResult instanceof Promise) { await renderDocumentResult }

  event.res.headers.set('content-type', 'text/html;charset=utf-8')
  event.res.headers.set('x-powered-by', 'Nuxt')

  // the app markup is sent as rendered chunks unless a listener changed it
  const chunks = ssrContext['~htmlChunks']
  if (!replaced && runtime.createDocumentResponse && chunks && htmlContext.body.length === 2 && htmlContext.body[0] === renderedHtml) {
    return runtime.createDocumentResponse(renderHTMLDocumentChunks(htmlContext, chunks), event.res)
  }
  return runtime.createResponse(documentContext.html, event.res)
}

function buildPayloadURL (ssrContext: NuxtSSRContext, cached: boolean): string {
  const baseURL = ssrContext.runtimeConfig.app.cdnURL || ssrContext.runtimeConfig.app.baseURL
  return routeToPayloadURL(baseURL, ssrContext.url, cached ? undefined : ssrContext.runtimeConfig.app.buildId)
}
