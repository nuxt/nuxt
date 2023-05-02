import { createRenderer, renderResourceHeaders } from 'vue-bundle-renderer/runtime'
import type { RenderResponse } from 'nitropack'
import type { Manifest } from 'vite'
import type { H3Event } from 'h3'
import { appendResponseHeader, createError, getQuery, readBody, writeEarlyHints } from 'h3'
import devalue from '@nuxt/devalue'
import { stringify, uneval } from 'devalue'
import destr from 'destr'
import { joinURL, withoutTrailingSlash } from 'ufo'
import { renderToString as _renderToString } from 'vue/server-renderer'
import { hash } from 'ohash'

import { defineRenderHandler, getRouteRules, useRuntimeConfig } from '#internal/nitro'
import { useNitroApp } from '#internal/nitro/app'

// eslint-disable-next-line import/no-restricted-paths
import type { NuxtApp, NuxtSSRContext } from '#app/nuxt'
// @ts-expect-error virtual file
import { appRootId, appRootTag } from '#internal/nuxt.config.mjs'
// @ts-expect-error virtual file
import { buildAssetsURL, publicAssetsURL } from '#paths'

// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__buildAssetsURL = buildAssetsURL
// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__publicAssetsURL = publicAssetsURL

export interface NuxtRenderHTMLContext {
  island?: boolean
  htmlAttrs: string[]
  head: string[]
  bodyAttrs: string[]
  bodyPrepend: string[]
  body: string[]
  bodyAppend: string[]
}

export interface NuxtIslandContext {
  id?: string
  name: string
  props?: Record<string, any>
  url?: string
}

export interface NuxtIslandResponse {
  id?: string
  html: string
  state: Record<string, any>
  head: {
    link: (Record<string, string>)[]
    style: ({ innerHTML: string, key: string })[]
  }
}

export interface NuxtRenderResponse {
  body: string,
  statusCode: number,
  statusMessage?: string,
  headers: Record<string, string>
}

interface ClientManifest {}

// @ts-expect-error file will be produced after app build
const getClientManifest: () => Promise<Manifest> = () => import('#build/dist/server/client.manifest.mjs')
  .then(r => r.default || r)
  .then(r => typeof r === 'function' ? r() : r) as Promise<ClientManifest>

// @ts-expect-error virtual file
const getStaticRenderedHead = (): Promise<NuxtMeta> => import('#head-static').then(r => r.default || r)

// @ts-expect-error file will be produced after app build
const getServerEntry = () => import('#build/dist/server/server.mjs').then(r => r.default || r)

// @ts-expect-error file will be produced after app build
const getSSRStyles = lazyCachedFunction((): Promise<Record<string, () => Promise<string[]>>> => import('#build/dist/server/styles.mjs').then(r => r.default || r))

// -- SSR Renderer --
const getSSRRenderer = lazyCachedFunction(async () => {
  // Load client manifest
  const manifest = await getClientManifest()
  if (!manifest) { throw new Error('client.manifest is not available') }

  // Load server bundle
  const createSSRApp = await getServerEntry()
  if (!createSSRApp) { throw new Error('Server bundle is not available') }

  const options = {
    manifest,
    renderToString,
    buildAssetsURL
  }
  // Create renderer
  const renderer = createRenderer(createSSRApp, options)

  type RenderToStringParams = Parameters<typeof _renderToString>
  async function renderToString (input: RenderToStringParams[0], context: RenderToStringParams[1]) {
    const html = await _renderToString(input, context)
    // In development with vite-node, the manifest is on-demand and will be available after rendering
    if (process.dev && process.env.NUXT_VITE_NODE_OPTIONS) {
      renderer.rendererContext.updateManifest(await getClientManifest())
    }
    return `<${appRootTag} id="${appRootId}">${html}</${appRootTag}>`
  }

  return renderer
})

// -- SPA Renderer --
const getSPARenderer = lazyCachedFunction(async () => {
  const manifest = await getClientManifest()

  const options = {
    manifest,
    renderToString: () => `<${appRootTag} id="${appRootId}"></${appRootTag}>`,
    buildAssetsURL
  }
  // Create SPA renderer and cache the result for all requests
  const renderer = createRenderer(() => () => {}, options)
  const result = await renderer.renderToString({})

  const renderToString = (ssrContext: NuxtSSRContext) => {
    const config = useRuntimeConfig()
    ssrContext!.payload = {
      _errors: {},
      serverRendered: false,
      data: {},
      state: {}
    }
    ssrContext.config = {
      public: config.public,
      app: config.app
    }
    ssrContext!.renderMeta = ssrContext!.renderMeta ?? getStaticRenderedHead
    return Promise.resolve(result)
  }

  return {
    rendererContext: renderer.rendererContext,
    renderToString
  }
})

async function getIslandContext (event: H3Event): Promise<NuxtIslandContext> {
  // TODO: Strict validation for url
  const url = event.node.req.url?.substring('/__nuxt_island'.length + 1) || ''
  const [componentName, hashId] = url.split('?')[0].split(':')

  // TODO: Validate context
  const context = event.node.req.method === 'GET' ? getQuery(event) : await readBody(event)

  const ctx: NuxtIslandContext = {
    url: '/',
    ...context,
    id: hashId,
    name: componentName,
    props: destr(context.props) || {}
  }

  return ctx
}

const PAYLOAD_CACHE = (process.env.NUXT_PAYLOAD_EXTRACTION && process.env.prerender) ? new Map() : null // TODO: Use LRU cache
const ISLAND_CACHE = (process.env.NUXT_COMPONENT_ISLANDS && process.env.prerender) ? new Map() : null // TODO: Use LRU cache
const PAYLOAD_URL_RE = process.env.NUXT_JSON_PAYLOADS ? /\/_payload(\.[a-zA-Z0-9]+)?.json(\?.*)?$/ : /\/_payload(\.[a-zA-Z0-9]+)?.js(\?.*)?$/
const ROOT_NODE_REGEX = new RegExp(`^<${appRootTag} id="${appRootId}">([\\s\\S]*)</${appRootTag}>$`)

const PRERENDER_NO_SSR_ROUTES = new Set(['/index.html', '/200.html', '/404.html'])

export default defineRenderHandler(async (event): Promise<Partial<RenderResponse>> => {
  const nitroApp = useNitroApp()

  // Whether we're rendering an error page
  const ssrError = event.node.req.url?.startsWith('/__nuxt_error')
    ? getQuery(event) as unknown as Exclude<NuxtApp['payload']['error'], Error>
    : null

  if (ssrError && ssrError.statusCode) {
    ssrError.statusCode = parseInt(ssrError.statusCode as any)
  }

  if (ssrError && event.node.req.socket.readyState !== 'readOnly' /* direct request */) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Page Not Found: /__nuxt_error'
    })
  }

  // Check for island component rendering
  const islandContext = (process.env.NUXT_COMPONENT_ISLANDS && event.node.req.url?.startsWith('/__nuxt_island'))
    ? await getIslandContext(event)
    : undefined

  if (process.env.prerender && islandContext && ISLAND_CACHE!.has(event.node.req.url)) {
    return ISLAND_CACHE!.get(event.node.req.url)
  }

  // Request url
  let url = ssrError?.url as string || islandContext?.url || event.node.req.url!

  // Whether we are rendering payload route
  const isRenderingPayload = PAYLOAD_URL_RE.test(url) && !islandContext
  if (isRenderingPayload) {
    url = url.substring(0, url.lastIndexOf('/')) || '/'
    event.node.req.url = url
    if (process.env.prerender && PAYLOAD_CACHE!.has(url)) {
      return PAYLOAD_CACHE!.get(url)
    }
  }

  // Get route options (currently to apply `ssr: false`)
  const routeOptions = getRouteRules(event)

  // Initialize ssr context
  const ssrContext: NuxtSSRContext = {
    url,
    event,
    runtimeConfig: useRuntimeConfig() as NuxtSSRContext['runtimeConfig'],
    noSSR:
      !!(process.env.NUXT_NO_SSR) ||
      event.context.nuxt?.noSSR ||
      routeOptions.ssr === false ||
      (process.env.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
    error: !!ssrError,
    nuxt: undefined!, /* NuxtApp */
    payload: (ssrError ? { error: ssrError } : {}) as NuxtSSRContext['payload'],
    _payloadReducers: {},
    islandContext
  }

  // Whether we are prerendering route
  const _PAYLOAD_EXTRACTION = process.env.prerender && process.env.NUXT_PAYLOAD_EXTRACTION && !ssrContext.noSSR && !islandContext
  const payloadURL = _PAYLOAD_EXTRACTION ? joinURL(useRuntimeConfig().app.baseURL, url, process.env.NUXT_JSON_PAYLOADS ? '_payload.json' : '_payload.js') : undefined
  if (process.env.prerender) {
    ssrContext.payload.prerenderedAt = Date.now()
  }

  // Render app
  const renderer = (process.env.NUXT_NO_SSR || ssrContext.noSSR) ? await getSPARenderer() : await getSSRRenderer()

  // Render 103 Early Hints
  if (process.env.NUXT_EARLY_HINTS && !isRenderingPayload && !process.env.prerender) {
    const { link } = renderResourceHeaders({}, renderer.rendererContext)
    writeEarlyHints(event, link)
  }

  const _rendered = await renderer.renderToString(ssrContext).catch(async (error) => {
    // Use explicitly thrown error in preference to subsequent rendering errors
    const _err = (!ssrError && ssrContext.payload?.error) || error
    await ssrContext.nuxt?.hooks.callHook('app:error', _err)
    throw _err
  })
  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext })

  if (ssrContext._renderResponse) { return ssrContext._renderResponse }

  if (event.node.res.headersSent || event.node.res.writableEnded) {
    // @ts-expect-error TODO: handle additional cases
    return
  }

  // Handle errors
  if (ssrContext.payload?.error && !ssrError) {
    throw ssrContext.payload.error
  }

  // Directly render payload routes
  if (isRenderingPayload) {
    const response = renderPayloadResponse(ssrContext)
    if (process.env.prerender) {
      PAYLOAD_CACHE!.set(url, response)
    }
    return response
  }

  if (_PAYLOAD_EXTRACTION) {
    // Hint nitro to prerender payload for this route
    appendResponseHeader(event, 'x-nitro-prerender', joinURL(url, process.env.NUXT_JSON_PAYLOADS ? '_payload.json' : '_payload.js'))
    // Use same ssr context to generate payload for this route
    PAYLOAD_CACHE!.set(withoutTrailingSlash(url), renderPayloadResponse(ssrContext))
  }

  // Render meta
  const renderedMeta = await ssrContext.renderMeta?.() ?? {}

  // Render inline styles
  const inlinedStyles = process.env.NUXT_INLINE_STYLES
    ? await renderInlineStyles(ssrContext.modules ?? ssrContext._registeredComponents ?? [])
    : ''

  const NO_SCRIPTS = process.env.NUXT_NO_SCRIPTS || routeOptions.experimentalNoScripts

  // Create render context
  const htmlContext: NuxtRenderHTMLContext = {
    island: Boolean(islandContext),
    htmlAttrs: normalizeChunks([renderedMeta.htmlAttrs]),
    head: normalizeChunks([
      renderedMeta.headTags,
      process.env.NUXT_JSON_PAYLOADS
        ? _PAYLOAD_EXTRACTION ? `<link rel="preload" as="fetch" crossorigin="anonymous" href="${payloadURL}">` : null
        : _PAYLOAD_EXTRACTION ? `<link rel="modulepreload" href="${payloadURL}">` : null,
      NO_SCRIPTS ? null : _rendered.renderResourceHints(),
      _rendered.renderStyles(),
      inlinedStyles,
      ssrContext.styles
    ]),
    bodyAttrs: normalizeChunks([renderedMeta.bodyAttrs!]),
    bodyPrepend: normalizeChunks([
      renderedMeta.bodyScriptsPrepend,
      ssrContext.teleports?.body
    ]),
    body: [_rendered.html],
    bodyAppend: normalizeChunks([
      NO_SCRIPTS
        ? undefined
        : (_PAYLOAD_EXTRACTION
            ? process.env.NUXT_JSON_PAYLOADS
              ? renderPayloadJsonScript({ id: '__NUXT_DATA__', ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL })
              : renderPayloadScript({ ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL })
            : process.env.NUXT_JSON_PAYLOADS
              ? renderPayloadJsonScript({ id: '__NUXT_DATA__', ssrContext, data: ssrContext.payload })
              : renderPayloadScript({ ssrContext, data: ssrContext.payload })
          ),
      routeOptions.experimentalNoScripts ? undefined : _rendered.renderScripts(),
      // Note: bodyScripts may contain tags other than <script>
      renderedMeta.bodyScripts
    ])
  }

  // Allow hooking into the rendered result
  await nitroApp.hooks.callHook('render:html', htmlContext, { event })

  // Response for component islands
  if (process.env.NUXT_COMPONENT_ISLANDS && islandContext) {
    const _tags = htmlContext.head.flatMap(head => extractHTMLTags(head))
    const head: NuxtIslandResponse['head'] = {
      link: _tags.filter(tag => tag.tagName === 'link' && tag.attrs.rel === 'stylesheet' && tag.attrs.href.includes('scoped') && !tag.attrs.href.includes('pages/')).map(tag => ({
        key: 'island-link-' + hash(tag.attrs.href),
        ...tag.attrs
      })),
      style: _tags.filter(tag => tag.tagName === 'style' && tag.innerHTML).map(tag => ({
        key: 'island-style-' + hash(tag.innerHTML),
        innerHTML: tag.innerHTML
      }))
    }

    const islandResponse: NuxtIslandResponse = {
      id: islandContext.id,
      head,
      html: getServerComponentHTML(htmlContext.body),
      state: ssrContext.payload.state
    }

    await nitroApp.hooks.callHook('render:island', islandResponse, { event, islandContext })

    const response: RenderResponse = {
      body: JSON.stringify(islandResponse, null, 2),
      statusCode: event.node.res.statusCode,
      statusMessage: event.node.res.statusMessage,
      headers: {
        'content-type': 'application/json;charset=utf-8',
        'x-powered-by': 'Nuxt'
      }
    }
    if (process.env.prerender) {
      ISLAND_CACHE!.set(`/__nuxt_island/${islandContext!.name}:${islandContext!.id}`, response)
    }
    return response
  }

  // Construct HTML response
  const response: RenderResponse = {
    body: renderHTMLDocument(htmlContext),
    statusCode: event.node.res.statusCode,
    statusMessage: event.node.res.statusMessage,
    headers: {
      'content-type': 'text/html;charset=utf-8',
      'x-powered-by': 'Nuxt'
    }
  }

  return response
})

function lazyCachedFunction<T> (fn: () => Promise<T>): () => Promise<T> {
  let res: Promise<T> | null = null
  return () => {
    if (res === null) {
      res = fn().catch((err) => { res = null; throw err })
    }
    return res
  }
}

function normalizeChunks (chunks: (string | undefined)[]) {
  return chunks.filter(Boolean).map(i => i!.trim())
}

function joinTags (tags: string[]) {
  return tags.join('')
}

function joinAttrs (chunks: string[]) {
  return chunks.join(' ')
}

function renderHTMLDocument (html: NuxtRenderHTMLContext) {
  return `<!DOCTYPE html>
<html ${joinAttrs(html.htmlAttrs)}>
<head>${joinTags(html.head)}</head>
<body ${joinAttrs(html.bodyAttrs)}>${joinTags(html.bodyPrepend)}${joinTags(html.body)}${joinTags(html.bodyAppend)}</body>
</html>`
}

// TODO: Move to external library
const HTML_TAG_RE = /<(?<tag>[a-z]+)(?<rawAttrs> [^>]*)?>(?:(?<innerHTML>[\s\S]*?)<\/\k<tag>)?/g
const HTML_TAG_ATTR_RE = /(?<name>[a-z]+)="(?<value>[^"]*)"/g
function extractHTMLTags (html: string) {
  const tags: { tagName: string, attrs: Record<string, string>, innerHTML: string }[] = []
  for (const tagMatch of html.matchAll(HTML_TAG_RE)) {
    const attrs: Record<string, string> = {}
    for (const attrMatch of tagMatch.groups!.rawAttrs?.matchAll(HTML_TAG_ATTR_RE) || []) {
      attrs[attrMatch.groups!.name] = attrMatch.groups!.value
    }
    const innerHTML = tagMatch.groups!.innerHTML || ''
    tags.push({ tagName: tagMatch.groups!.tag, attrs, innerHTML })
  }
  return tags
}

async function renderInlineStyles (usedModules: Set<string> | string[]) {
  const styleMap = await getSSRStyles()
  const inlinedStyles = new Set<string>()
  for (const mod of usedModules) {
    if (mod in styleMap) {
      for (const style of await styleMap[mod]()) {
        inlinedStyles.add(`<style>${style}</style>`)
      }
    }
  }
  return Array.from(inlinedStyles).join('')
}

function renderPayloadResponse (ssrContext: NuxtSSRContext) {
  return <RenderResponse> {
    body: process.env.NUXT_JSON_PAYLOADS
      ? stringify(splitPayload(ssrContext).payload, ssrContext._payloadReducers)
      : `export default ${devalue(splitPayload(ssrContext).payload)}`,
    statusCode: ssrContext.event.node.res.statusCode,
    statusMessage: ssrContext.event.node.res.statusMessage,
    headers: {
      'content-type': process.env.NUXT_JSON_PAYLOADS ? 'application/json;charset=utf-8' : 'text/javascript;charset=utf-8',
      'x-powered-by': 'Nuxt'
    }
  }
}

function renderPayloadJsonScript (opts: { id: string, ssrContext: NuxtSSRContext, data?: any, src?: string }) {
  const attrs = [
    'type="application/json"',
    `id="${opts.id}"`,
    `data-ssr="${!(process.env.NUXT_NO_SSR || opts.ssrContext.noSSR)}"`,
    opts.src ? `data-src="${opts.src}"` : ''
  ].filter(Boolean)
  const contents = opts.data ? stringify(opts.data, opts.ssrContext._payloadReducers) : ''
  return `<script ${attrs.join(' ')}>${contents}</script>` +
    `<script>window.__NUXT__={};window.__NUXT__.config=${uneval(opts.ssrContext.config)}</script>`
}

function renderPayloadScript (opts: { ssrContext: NuxtSSRContext, data?: any, src?: string }) {
  opts.data.config = opts.ssrContext.config
  const _PAYLOAD_EXTRACTION = process.env.prerender && process.env.NUXT_PAYLOAD_EXTRACTION && !opts.ssrContext.noSSR
  if (_PAYLOAD_EXTRACTION) {
    return `<script type="module">import p from "${opts.src}";window.__NUXT__={...p,...(${devalue(opts.data)})}</script>`
  }
  return `<script>window.__NUXT__=${devalue(opts.data)}</script>`
}

function splitPayload (ssrContext: NuxtSSRContext) {
  const { data, prerenderedAt, ...initial } = ssrContext.payload
  return {
    initial: { ...initial, prerenderedAt },
    payload: { data, prerenderedAt }
  }
}

/**
 * remove the root node from the html body
 */
function getServerComponentHTML (body: string[]): string {
  const match = body[0].match(ROOT_NODE_REGEX)
  return match ? match[1] : body[0]
}
