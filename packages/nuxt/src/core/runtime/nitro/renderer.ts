import { createRenderer, renderResourceHeaders } from 'vue-bundle-renderer/runtime'
import type { RenderResponse } from 'nitropack'
import type { Manifest } from 'vite'
import type { H3Event } from 'h3'
import { appendHeader, getQuery, writeEarlyHints, readBody, createError } from 'h3'
import devalue from '@nuxt/devalue'
import destr from 'destr'
import { joinURL } from 'ufo'
import { renderToString as _renderToString } from 'vue/server-renderer'
import { useRuntimeConfig, defineRenderHandler, getRouteRules } from '#internal/nitro'
import { hash } from 'ohash'
// @ts-ignore
import { useNitroApp } from '#internal/nitro/app'
// eslint-disable-next-line import/no-restricted-paths
import type { NuxtApp, NuxtSSRContext } from '#app/nuxt'
// @ts-ignore
import { appRootId, appRootTag } from '#internal/nuxt.config.mjs'
// @ts-ignore
import { buildAssetsURL, publicAssetsURL } from '#paths'

// @ts-ignore
globalThis.__buildAssetsURL = buildAssetsURL
// @ts-ignore
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

// @ts-ignore
const getClientManifest: () => Promise<Manifest> = () => import('#build/dist/server/client.manifest.mjs')
  .then(r => r.default || r)
  .then(r => typeof r === 'function' ? r() : r) as Promise<ClientManifest>

// @ts-ignore
const getStaticRenderedHead = (): Promise<NuxtMeta> => import('#head-static').then(r => r.default || r)

// @ts-ignore
const getServerEntry = () => import('#build/dist/server/server.mjs').then(r => r.default || r)

// @ts-ignore
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
      serverRendered: false,
      config: {
        public: config.public,
        app: config.app
      },
      data: {},
      state: {}
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
const PAYLOAD_URL_RE = /\/_payload(\.[a-zA-Z0-9]+)?.js(\?.*)?$/

const PRERENDER_NO_SSR_ROUTES = new Set(['/index.html', '/200.html', '/404.html'])

export default defineRenderHandler(async (event) => {
  const nitroApp = useNitroApp()

  // Whether we're rendering an error page
  const ssrError = event.node.req.url?.startsWith('/__nuxt_error')
    ? getQuery(event) as unknown as Exclude<NuxtApp['payload']['error'], Error>
    : null

  if (ssrError && ssrError.statusCode) {
    ssrError.statusCode = parseInt(ssrError.statusCode as any)
  }

  if (ssrError && event.node.req.socket.readyState !== 'readOnly' /* direct request */) {
    throw createError('Cannot directly render error page!')
  }

  // Check for island component rendering
  const islandContext = (process.env.NUXT_COMPONENT_ISLANDS && event.node.req.url?.startsWith('/__nuxt_island'))
    ? await getIslandContext(event)
    : undefined

  // Request url
  let url = ssrError?.url as string || islandContext?.url || event.node.req.url!

  // Whether we are rendering payload route
  const isRenderingPayload = PAYLOAD_URL_RE.test(url)
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
      !!(event.node.req.headers['x-nuxt-no-ssr']) ||
      routeOptions.ssr === false ||
      (process.env.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
    error: !!ssrError,
    nuxt: undefined!, /* NuxtApp */
    payload: (ssrError ? { error: ssrError } : {}) as NuxtSSRContext['payload'],
    islandContext
  }

  // Whether we are prerendering route
  const _PAYLOAD_EXTRACTION = process.env.prerender && process.env.NUXT_PAYLOAD_EXTRACTION && !ssrContext.noSSR
  const payloadURL = _PAYLOAD_EXTRACTION ? joinURL(useRuntimeConfig().app.baseURL, url, '_payload.js') : undefined
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

  const _rendered = await renderer.renderToString(ssrContext).catch((error) => {
    // Use explicitly thrown error in preference to subsequent rendering errors
    throw (!ssrError && ssrContext.payload?.error) || error
  })
  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext })

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
    appendHeader(event, 'x-nitro-prerender', joinURL(url, '_payload.js'))
    // Use same ssr context to generate payload for this route
    PAYLOAD_CACHE!.set(url, renderPayloadResponse(ssrContext))
  }

  // Render meta
  const renderedMeta = await ssrContext.renderMeta?.() ?? {}

  // Render inline styles
  const inlinedStyles = process.env.NUXT_INLINE_STYLES
    ? await renderInlineStyles(ssrContext.modules ?? ssrContext._registeredComponents ?? [])
    : ''

  // Create render context
  const htmlContext: NuxtRenderHTMLContext = {
    island: Boolean(islandContext),
    htmlAttrs: normalizeChunks([renderedMeta.htmlAttrs]),
    head: normalizeChunks([
      renderedMeta.headTags,
      _PAYLOAD_EXTRACTION ? `<link rel="modulepreload" href="${payloadURL}">` : null,
      _rendered.renderResourceHints(),
      _rendered.renderStyles(),
      inlinedStyles,
      ssrContext.styles
    ]),
    bodyAttrs: normalizeChunks([renderedMeta.bodyAttrs!]),
    bodyPrepend: normalizeChunks([
      renderedMeta.bodyScriptsPrepend,
      ssrContext.teleports?.body
    ]),
    body: (process.env.NUXT_COMPONENT_ISLANDS && islandContext) ? [] : [_rendered.html],
    bodyAppend: normalizeChunks([
      process.env.NUXT_NO_SCRIPTS
        ? undefined
        : (_PAYLOAD_EXTRACTION
            ? `<script type="module">import p from "${payloadURL}";window.__NUXT__={...p,...(${devalue(splitPayload(ssrContext).initial)})}</script>`
            : `<script>window.__NUXT__=${devalue(ssrContext.payload)}</script>`
          ),
      _rendered.renderScripts(),
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
      html: ssrContext.teleports!['nuxt-island'].replace(/<!--.*-->/g, ''),
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
    body: `export default ${devalue(splitPayload(ssrContext).payload)}`,
    statusCode: ssrContext.event.node.res.statusCode,
    statusMessage: ssrContext.event.node.res.statusMessage,
    headers: {
      'content-type': 'text/javascript;charset=UTF-8',
      'x-powered-by': 'Nuxt'
    }
  }
}

function splitPayload (ssrContext: NuxtSSRContext) {
  const { data, prerenderedAt, ...initial } = ssrContext.payload
  return {
    initial: { ...initial, prerenderedAt },
    payload: { data, prerenderedAt }
  }
}
