import { getPrefetchLinks, getPreloadLinks, getRequestDependencies, renderResourceHeaders } from 'vue-bundle-renderer/runtime'
import { getQuery as getURLQuery, joinURL } from 'ufo'
import { renderSSRHead } from '@unhead/vue/server'
import type { Link } from '@unhead/vue/types'
import destr from 'destr'
import type { NuxtRenderHTMLContext, NuxtSSRContext, SerializedErrorCause } from '#app/types'
import { traceAsync } from '../../../app/internal/tracing.ts'

import { renderPayloadResponse } from './payload'
import { createSSRContext, returnRenderResponse, setSSRError } from './app'
import { renderSplitInlineStyles } from './inline-styles'
import { createInlinedCSSFilter } from './inlined-css'
import { throwIfUnmatchedPagePath, toPageMatcherPath } from './early-404'
import { replaceIslandTeleports } from './islands'
import { warnNoScriptsClientReliance } from './no-scripts'
import { payloadRequestToRoute, routeToPayloadURL, withRequestPath } from './url'
import { addPrerenderRoutes, appEvent, getRequestState } from './runtime'
import { createRendererInstance } from './instance'
import type { NuxtRendererInstance } from './instance'
import type { NuxtRendererOptions, RenderedResponse, RendererEvent } from './runtime'
import { getPrerenderedErrorPage, isPrerenderedErrorPage, renderErrorResponse } from './error-page'
import type { SSRError } from './error-page'
import { normalizeChunks, renderAppTeleports, renderHTMLDocument, renderHTMLDocumentChunks } from './document'
import { inertPrefetchLink, inlinesStyles, isDevInlineStyle, pushEntryImportMap, pushEntryScripts, pushNoScriptsHints, pushPayloadPreload, pushPayloadScript } from './head'
import { renderStreamedResponse } from './stream'
import { NUXT_DEFER_PREFETCH_HINTS, NUXT_EARLY_404, NUXT_EARLY_HINTS, NUXT_INLINE_ERROR_RENDERING, NUXT_INLINE_STYLES, NUXT_JSON_PAYLOADS, NUXT_NO_SCRIPTS, NUXT_NO_SCRIPTS_PROD, NUXT_PAYLOAD_EXTRACTION, NUXT_PAYLOAD_INLINE, NUXT_PRERENDER_NO_SSR_ROUTES, NUXT_RUNTIME_PAYLOAD_EXTRACTION, NUXT_SPA_PAGE_MATCHER, NUXT_SSR_STREAMING, NUXT_SSR_STREAMING_BOT_RE, PARSE_ERROR_DATA, appHead, componentIslands, componentIslandsActive, renderSSRHeadOptions, tracingChannelNuxt } from 'nuxt/internal/renderer-config'
import entryIds from 'nuxt/internal/entry-ids'
import { entryFileName } from 'nuxt/internal/entry-chunk'

export { createRendererInstance } from './instance'
export type { NuxtRendererInstance } from './instance'
export type { CachedResponse, NuxtRendererOptions, NuxtRequestState, PayloadCache, RenderedResponse, RendererEvent, RendererHooks, RendererRouteRules } from './runtime'
export { appEvent } from './runtime'

const PAYLOAD_URL_RE = NUXT_JSON_PAYLOADS ? /^[^?]*\/_payload.json(?:\?.*)?$/ : /^[^?]*\/_payload.js(?:\?.*)?$/
const PAYLOAD_FILENAME = NUXT_JSON_PAYLOADS ? '_payload.json' : '_payload.js'

// Bot detection regex for SSR streaming.
const SSR_BOT_RE: RegExp = NUXT_SSR_STREAMING_BOT_RE

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

  // The internal error route renders the error it is passed, so it is only served to a
  // request the runtime made to render one. A static error page carries no such error:
  // its own is synthesised from the path it is prerendered at.
  const isErrorRoute = event.url.pathname.startsWith('/__nuxt_error')

  // a render the runtime re-entered to build *its* error page keeps throwing back to it, as does
  // a payload render
  const inlineErrors = NUXT_INLINE_ERROR_RENDERING
    && !getRequestState(event)?.['~rendering-error']
    && !PAYLOAD_URL_RE.test(event.url.pathname)
  const renderErrorPage = (error: unknown) => renderErrorResponse(runtime, event, error, ssrError => renderRoute(instance, event, ssrError))

  if (isErrorRoute && !getRequestState(event)?.['~rendering-error']) {
    const error = runtime.createError({
      status: 404,
      statusText: 'Page Not Found: /__nuxt_error',
    })
    return inlineErrors ? renderErrorPage(error) : Promise.reject(error)
  }

  const ssrError = isErrorRoute
    ? getURLQuery(event.url.href) as unknown as SSRError
    : import.meta.prerender
      ? getPrerenderedErrorPage(event)
      : null

  const render = () => renderRoute(instance, event, ssrError).then(response => returnRenderResponse(runtime, event, response))
  const wrapRender = import.meta.prerender ? runtime.prerender?.wrapRender : undefined
  const rendering = wrapRender ? wrapRender(event, render) : render()

  return inlineErrors
    ? rendering.catch(renderErrorPage)
    : rendering
}

async function renderRoute (instance: NuxtRendererInstance, event: RendererEvent, ssrError: SSRError | null): Promise<RenderedResponse> {
  const runtime = instance.options
  const hooks = runtime.hooks()
  const hookEvent = appEvent(event)
  const payloadCache = runtime.prerender?.payloadCache

  const ssrContext: NuxtSSRContext = createSSRContext(runtime, event)

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
    if (import.meta.dev && typeof (ssrError as { cause?: unknown }).cause === 'string') {
      (ssrError as { cause?: SerializedErrorCause }).cause = destr((ssrError as { cause?: string }).cause)
    }
    setSSRError(ssrContext, ssrError)
  }

  const routeOptions = runtime.getRouteRules(event)
  const NO_SCRIPTS = NUXT_NO_SCRIPTS || !!routeOptions.noScripts
  const DEFER_PREFETCH = NUXT_DEFER_PREFETCH_HINTS && !NO_SCRIPTS

  // an error page rendered as an empty SPA shell shows the visitor nothing
  if (routeOptions.ssr === false && !(NUXT_INLINE_ERROR_RENDERING && ssrError)) {
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
    ssrContext.url = payloadRequestToRoute(ssrContext.url, PAYLOAD_FILENAME)

    // the app renders the page the payload belongs to, not the payload URL it was requested at
    event.url = withRequestPath(event.url, ssrContext.url)
    // Replay a cached payload only during prerender. At runtime the cache is keyed by path
    // alone, so serving it would return one principal's SSR data to another and skip route
    // middleware / page guards; runtime payload requests must fall through to a full render.
    const cacheKey = getPayloadCacheKey(ssrContext.url)
    if (import.meta.prerender && payloadCache && await payloadCache.hasItem(cacheKey)) {
      return (await payloadCache.getItem(cacheKey)) as RenderedResponse
    }
  }

  const payloadURL = payloadExtraction ? buildPayloadURL(ssrContext) : undefined

  const renderer = await instance.getRenderer(ssrContext)
  const { rendererContext } = renderer

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
      && !SSR_BOT_RE.test(event.req.headers.get('user-agent') || '')),
  }
  await hooks.callHook('render:route', renderRouteContext, { event: hookEvent })

  if (NUXT_SSR_STREAMING && canStream && renderRouteContext.prefersStream) {
    const stream = { instance, event, ssrContext, renderer, routeOptions, noScripts: NO_SCRIPTS, ssrError, payloadExtraction, payloadInline, payloadURL }
    return tracingChannelNuxt
      ? traceAsync('nuxt.render', { event: hookEvent, ssrContext, streaming: true }, () => renderStreamedResponse(stream))
      : renderStreamedResponse(stream)
  }

  const _rendered = await (tracingChannelNuxt
    ? traceAsync('nuxt.render', { event: hookEvent, ssrContext, streaming: false }, () => renderer.renderToString(ssrContext))
    : renderer.renderToString(ssrContext)
  ).catch(async (error) => {
    // We use error to bypass full render if we have an early response we can make
    // TODO: remove _renderResponse in nuxt v5
    if ((ssrContext['~renderResponse'] || ssrContext._renderResponse) && error.message === 'skipping render') { return {} as ReturnType<typeof renderer['renderToString']> }

    // Use explicitly thrown error in preference to subsequent rendering errors
    const _err = (!ssrError && ssrContext.payload?.error) || error
    await ssrContext.nuxt?.hooks.callHook('app:error', _err)
    throw _err
  })

  const renderedHtml = _rendered.html

  const inlineStyles = inlinesStyles(NO_SCRIPTS)
  // TODO: remove _renderResponse in nuxt v5
  const [entryInlinedStyles, componentInlinedStyles] = inlineStyles && !ssrContext['~renderResponse'] && !ssrContext._renderResponse && !isRenderingPayload
    ? await renderSplitInlineStyles(ssrContext.modules ?? [], entryIds)
    : [[], []]

  if (import.meta.prerender && ssrError && isPrerenderedErrorPage(event.url.pathname)) {
    delete ssrContext.payload.path
    if (ssrContext.payload.error) {
      (ssrContext.payload.error as { url?: string }).url = undefined
    }
  }

  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult: _rendered })

  if (ssrContext['~renderResponse'] || ssrContext._renderResponse) {
    // TODO: remove _renderResponse in nuxt v5
    return ssrContext['~renderResponse'] || (ssrContext._renderResponse as never)
  }

  if (ssrContext.payload?.error && !ssrError) {
    throw ssrContext.payload.error
  }

  if (isRenderingPayload) {
    const response = renderPayloadResponse(ssrContext, event)
    if (import.meta.prerender && payloadCache) {
      await payloadCache.setItem(getPayloadCacheKey(ssrContext.url), response)
    }
    return response
  }

  if (payloadExtraction && import.meta.prerender) {
    // the payload for this route is prerendered alongside it
    addPrerenderRoutes(event, joinURL(ssrContext.url.replace(/\?.*$/, ''), PAYLOAD_FILENAME))
    // Warm the cache for prerendered `_payload.json` requests. Confined to prerender: a
    // runtime write would persist one principal's payload under a path-only key.
    if (payloadCache) {
      await payloadCache.setItem(getPayloadCacheKey(ssrContext.url), renderPayloadResponse(ssrContext, event))
    }
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
    const file = rendererContext.manifest?.[id]?.file
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
    pushPayloadScript(ssrContext, payloadInline, payloadURL, routeOptions)
  }
  if (!routeOptions.noScripts) {
    pushEntryScripts(ssrContext, scripts, rendererContext, payloadExtraction && !payloadInline && !NUXT_JSON_PAYLOADS ? 'bodyClose' : 'head')
  }

  // TODO: migrate to `ssrContext.head.render()` once `renderSSRHeadOptions` (e.g. `omitLineBreaks`) can be passed to `createServerHead` at construction time.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = renderSSRHead(ssrContext.head, renderSSRHeadOptions)

  const htmlContext: NuxtRenderHTMLContext = {
    htmlAttrs: htmlAttrs ? [htmlAttrs] : [],
    head: normalizeChunks([headTags]),
    bodyAttrs: bodyAttrs ? [bodyAttrs] : [],
    bodyPrepend: normalizeChunks([bodyTagsOpen, ssrContext.teleports?.body]),
    body: [
      componentIslands ? replaceIslandTeleports(ssrContext, _rendered.html) : _rendered.html,
      renderAppTeleports(ssrContext),
    ],
    bodyAppend: [bodyTags],
  }

  await hooks.callHook('render:html', htmlContext, { event: hookEvent })

  const response = {
    statusCode: event.res.status,
    statusMessage: event.res.statusText,
    headers: {
      'content-type': 'text/html;charset=utf-8',
      'x-powered-by': 'Nuxt',
    },
  } satisfies RenderedResponse

  // the app markup is sent as rendered chunks unless a listener changed it
  const chunks = ssrContext['~htmlChunks']
  if (runtime.createDocumentResponse && chunks && htmlContext.body.length === 2 && htmlContext.body[0] === renderedHtml) {
    return { ...response, chunks: renderHTMLDocumentChunks(htmlContext, chunks) }
  }
  return { ...response, body: renderHTMLDocument(htmlContext) }
}

function buildPayloadURL (ssrContext: NuxtSSRContext): string {
  const baseURL = ssrContext.runtimeConfig.app.cdnURL || ssrContext.runtimeConfig.app.baseURL
  return routeToPayloadURL(baseURL, ssrContext.url, ssrContext.runtimeConfig.app.buildId, PAYLOAD_FILENAME)
}

// `unstorage`'s `normalizeKey` drops everything from `?` onwards, so using a raw
// URL as the payload cache key makes query-aware cached routes (e.g. `?page=1` vs
// `?page=2`) collide. Encode the query into a normalization-safe segment instead.
function getPayloadCacheKey (url: string): string {
  const { pathname, search } = new URL(url, 'http://localhost')
  const path = pathname === '/' ? '/' : pathname.replace(/\/$/, '')
  return path + (search ? encodeURIComponent(search) : '') + '.json'
}
