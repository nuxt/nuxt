import { AsyncLocalStorage } from 'node:async_hooks'
import {
  createRenderer,
  getPrefetchLinks,
  getPreloadLinks,
  getRequestDependencies,
  renderResourceHeaders
} from 'vue-bundle-renderer/runtime'
import type { RenderResponse } from 'nitropack'
import type { Manifest } from 'vite'
import type { H3Event } from 'h3'
import { appendResponseHeader, createError, getQuery, getResponseStatus, getResponseStatusText, readBody, writeEarlyHints } from 'h3'
import devalue from '@nuxt/devalue'
import { stringify, uneval } from 'devalue'
import destr from 'destr'
import { joinURL, withoutTrailingSlash } from 'ufo'
import { renderToString as _renderToString } from 'vue/server-renderer'
import { hash } from 'ohash'
import { renderSSRHead } from '@unhead/ssr'
import type { HeadEntryOptions } from '@unhead/schema'

import { defineRenderHandler, getRouteRules, useRuntimeConfig, useStorage } from '#internal/nitro'
import { useNitroApp } from '#internal/nitro/app'

import type { Link, Script, Style } from '@unhead/vue'
import { createServerHead } from '@unhead/vue'
// @ts-expect-error virtual file
import unheadPlugins from '#internal/unhead-plugins.mjs'
// eslint-disable-next-line import/no-restricted-paths
import type { NuxtPayload, NuxtSSRContext } from '#app/nuxt'
// @ts-expect-error virtual file
import { appHead, appRootId, appRootTag } from '#internal/nuxt.config.mjs'
// @ts-expect-error virtual file
import { buildAssetsURL, publicAssetsURL } from '#paths'

// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__buildAssetsURL = buildAssetsURL
// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__publicAssetsURL = publicAssetsURL

// Polyfill for unctx (https://github.com/unjs/unctx#native-async-context)
if (process.env.NUXT_ASYNC_CONTEXT && !('AsyncLocalStorage' in globalThis)) {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage
}

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

const getEntryIds: () => Promise<string[]> = () => getClientManifest().then(r => Object.values(r).filter(r =>
  // @ts-expect-error internal key set by CSS inlining configuration
  r._globalCSS
).map(r => r.src!))

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
    if (import.meta.dev && process.env.NUXT_VITE_NODE_OPTIONS) {
      renderer.rendererContext.updateManifest(await getClientManifest())
    }
    return `<${appRootTag}${appRootId ? ` id="${appRootId}"` : ''}>${html}</${appRootTag}>`
  }

  return renderer
})

// -- SPA Renderer --
const getSPARenderer = lazyCachedFunction(async () => {
  const manifest = await getClientManifest()

  // @ts-expect-error virtual file
  const spaTemplate = await import('#spa-template').then(r => r.template).catch(() => '')

  const options = {
    manifest,
    renderToString: () => `<${appRootTag}${appRootId ? ` id="${appRootId}"` : ''}>${spaTemplate}</${appRootTag}>`,
    buildAssetsURL
  }
  // Create SPA renderer and cache the result for all requests
  const renderer = createRenderer(() => () => {}, options)
  const result = await renderer.renderToString({})

  const renderToString = (ssrContext: NuxtSSRContext) => {
    const config = useRuntimeConfig()
    ssrContext.modules = ssrContext.modules || new Set<string>()
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
    return Promise.resolve(result)
  }

  return {
    rendererContext: renderer.rendererContext,
    renderToString
  }
})

const payloadCache = import.meta.prerender ? useStorage('internal:nuxt:prerender:payload') : null
const islandCache = import.meta.prerender ? useStorage('internal:nuxt:prerender:island') : null
const islandPropCache = import.meta.prerender ? useStorage('internal:nuxt:prerender:island-props') : null

async function getIslandContext (event: H3Event): Promise<NuxtIslandContext> {
  // TODO: Strict validation for url
  let url = event.path || ''
  if (import.meta.prerender && event.path && await islandPropCache!.hasItem(event.path)) {
    // rehydrate props from cache so we can rerender island if cache does not have it any more
    url = await islandPropCache!.getItem(event.path) as string
  }
  url = url.substring('/__nuxt_island'.length + 1) || ''
  const [componentName, hashId] = url.split('?')[0].split('_')

  // TODO: Validate context
  const context = event.method === 'GET' ? getQuery(event) : await readBody(event)

  const ctx: NuxtIslandContext = {
    url: '/',
    ...context,
    id: hashId,
    name: componentName,
    props: destr(context.props) || {},
    uid: destr(context.uid) || undefined
  }

  return ctx
}

const PAYLOAD_URL_RE = process.env.NUXT_JSON_PAYLOADS ? /\/_payload(\.[a-zA-Z0-9]+)?.json(\?.*)?$/ : /\/_payload(\.[a-zA-Z0-9]+)?.js(\?.*)?$/
const ROOT_NODE_REGEX = new RegExp(`^<${appRootTag}${appRootId ? ` id="${appRootId}"` : ''}>([\\s\\S]*)</${appRootTag}>$`)

const PRERENDER_NO_SSR_ROUTES = new Set(['/index.html', '/200.html', '/404.html'])

export default defineRenderHandler(async (event): Promise<Partial<RenderResponse>> => {
  const nitroApp = useNitroApp()

  // Whether we're rendering an error page
  const ssrError = event.path.startsWith('/__nuxt_error')
    ? getQuery(event) as unknown as Exclude<NuxtPayload['error'], Error>
    : null

  if (ssrError && ssrError.statusCode) {
    ssrError.statusCode = parseInt(ssrError.statusCode as any)
  }

  if (ssrError && !('__unenv__' in event.node.req) /* allow internal fetch */) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Page Not Found: /__nuxt_error'
    })
  }

  // Check for island component rendering
  const islandContext = (process.env.NUXT_COMPONENT_ISLANDS && event.path.startsWith('/__nuxt_island'))
    ? await getIslandContext(event)
    : undefined

  if (import.meta.prerender && islandContext && event.path && await islandCache!.hasItem(event.path)) {
    return islandCache!.getItem(event.path) as Promise<Partial<RenderResponse>>
  }

  // Request url
  let url = ssrError?.url as string || islandContext?.url || event.path

  // Whether we are rendering payload route
  const isRenderingPayload = PAYLOAD_URL_RE.test(url) && !islandContext
  if (isRenderingPayload) {
    url = url.substring(0, url.lastIndexOf('/')) || '/'

    event._path = url
    event.node.req.url = url
    if (import.meta.prerender && await payloadCache!.hasItem(url)) {
      return payloadCache!.getItem(url) as Promise<Partial<RenderResponse>>
    }
  }

  // Get route options (currently to apply `ssr: false`)
  const routeOptions = getRouteRules(event)

  const head = createServerHead({
    plugins: unheadPlugins
  })
  // needed for hash hydration plugin to work
  const headEntryOptions: HeadEntryOptions = { mode: 'server' }
  head.push(appHead, headEntryOptions)

  // Initialize ssr context
  const ssrContext: NuxtSSRContext = {
    url,
    event,
    runtimeConfig: useRuntimeConfig() as NuxtSSRContext['runtimeConfig'],
    noSSR:
      !!(process.env.NUXT_NO_SSR) ||
      event.context.nuxt?.noSSR ||
      (routeOptions.ssr === false && !islandContext) ||
      (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
    head,
    error: !!ssrError,
    nuxt: undefined!, /* NuxtApp */
    payload: (ssrError ? { error: ssrError } : {}) as NuxtPayload,
    _payloadReducers: {},
    islandContext
  }

  // Whether we are prerendering route
  const _PAYLOAD_EXTRACTION = import.meta.prerender && process.env.NUXT_PAYLOAD_EXTRACTION && !ssrContext.noSSR && !islandContext
  const payloadURL = _PAYLOAD_EXTRACTION ? joinURL(useRuntimeConfig().app.baseURL, url, process.env.NUXT_JSON_PAYLOADS ? '_payload.json' : '_payload.js') : undefined
  if (import.meta.prerender) {
    ssrContext.payload.prerenderedAt = Date.now()
  }

  // Render app
  const renderer = (process.env.NUXT_NO_SSR || ssrContext.noSSR) ? await getSPARenderer() : await getSSRRenderer()

  // Render 103 Early Hints
  if (process.env.NUXT_EARLY_HINTS && !isRenderingPayload && !import.meta.prerender) {
    const { link } = renderResourceHeaders({}, renderer.rendererContext)
    writeEarlyHints(event, link)
  }

  const _rendered = await renderer.renderToString(ssrContext).catch(async (error) => {
    // We use error to bypass full render if we have an early response we can make
    if (ssrContext._renderResponse && error.message === 'skipping render') { return {} as ReturnType<typeof renderer['renderToString']> }

    // Use explicitly thrown error in preference to subsequent rendering errors
    const _err = (!ssrError && ssrContext.payload?.error) || error
    await ssrContext.nuxt?.hooks.callHook('app:error', _err)
    throw _err
  })
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
      await payloadCache!.setItem(url, response)
    }
    return response
  }

  if (_PAYLOAD_EXTRACTION) {
    // Hint nitro to prerender payload for this route
    appendResponseHeader(event, 'x-nitro-prerender', joinURL(url, process.env.NUXT_JSON_PAYLOADS ? '_payload.json' : '_payload.js'))
    // Use same ssr context to generate payload for this route
    await payloadCache!.setItem(withoutTrailingSlash(url), renderPayloadResponse(ssrContext))
  }

  if (process.env.NUXT_INLINE_STYLES && !islandContext) {
    const source = ssrContext.modules ?? ssrContext._registeredComponents
    if (source) {
      for (const id of await getEntryIds()) {
        source.add(id)
      }
    }
  }

  // Render inline styles
  const inlinedStyles = (process.env.NUXT_INLINE_STYLES || Boolean(islandContext))
    ? await renderInlineStyles(ssrContext.modules ?? ssrContext._registeredComponents ?? [])
    : []

  const NO_SCRIPTS = process.env.NUXT_NO_SCRIPTS || routeOptions.experimentalNoScripts

  // Setup head
  const { styles, scripts } = getRequestDependencies(ssrContext, renderer.rendererContext)
  // 1.Extracted payload preloading
  if (_PAYLOAD_EXTRACTION) {
    head.push({
      link: [
        process.env.NUXT_JSON_PAYLOADS
          ? { rel: 'preload', as: 'fetch', crossorigin: 'anonymous', href: payloadURL }
          : { rel: 'modulepreload', href: payloadURL }
      ]
    }, headEntryOptions)
  }

  // 2. Styles
  head.push({ style: inlinedStyles })
  head.push({
    link: Object.values(styles)
      .map(resource =>
        ({ rel: 'stylesheet', href: renderer.rendererContext.buildAssetsURL(resource.file) })
      )
  }, headEntryOptions)

  if (!NO_SCRIPTS) {
    // 3. Resource Hints
    // TODO: add priorities based on Capo
    head.push({
      link: getPreloadLinks(ssrContext, renderer.rendererContext) as Link[]
    }, headEntryOptions)
    head.push({
      link: getPrefetchLinks(ssrContext, renderer.rendererContext) as Link[]
    }, headEntryOptions)
    // 4. Payloads
    head.push({
      script: _PAYLOAD_EXTRACTION
        ? process.env.NUXT_JSON_PAYLOADS
          ? renderPayloadJsonScript({ id: '__NUXT_DATA__', ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL })
          : renderPayloadScript({ ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL })
        : process.env.NUXT_JSON_PAYLOADS
          ? renderPayloadJsonScript({ id: '__NUXT_DATA__', ssrContext, data: ssrContext.payload })
          : renderPayloadScript({ ssrContext, data: ssrContext.payload })
    }, {
      ...headEntryOptions,
      // this should come before another end of body scripts
      tagPosition: 'bodyClose',
      tagPriority: 'high'
    })
  }

  // 5. Scripts
  if (!routeOptions.experimentalNoScripts) {
    head.push({
      script: Object.values(scripts).map(resource => (<Script> {
        type: resource.module ? 'module' : null,
        src: renderer.rendererContext.buildAssetsURL(resource.file),
        defer: resource.module ? null : true,
        crossorigin: ''
      }))
    }, headEntryOptions)
  }

  // remove certain tags for nuxt islands
  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = await renderSSRHead(head)

  // Create render context
  const htmlContext: NuxtRenderHTMLContext = {
    island: Boolean(islandContext),
    htmlAttrs: [htmlAttrs],
    head: normalizeChunks([headTags, ssrContext.styles]),
    bodyAttrs: [bodyAttrs],
    bodyPrepend: normalizeChunks([bodyTagsOpen, ssrContext.teleports?.body]),
    body: [process.env.NUXT_COMPONENT_ISLANDS ? replaceServerOnlyComponentsSlots(ssrContext, _rendered.html) : _rendered.html],
    bodyAppend: [bodyTags]
  }

  // Allow hooking into the rendered result
  await nitroApp.hooks.callHook('render:html', htmlContext, { event })

  // Response for component islands
  if (process.env.NUXT_COMPONENT_ISLANDS && islandContext) {
    const islandHead: NuxtIslandResponse['head'] = {
      link: [],
      style: []
    }
    for (const tag of await head.resolveTags()) {
      if (tag.tag === 'link' && tag.props.rel === 'stylesheet' && tag.props.href.includes('scoped') && !tag.props.href.includes('pages/')) {
        islandHead.link.push({ ...tag.props, key: 'island-link-' + hash(tag.props.href) })
      }
      if (tag.tag === 'style' && tag.innerHTML) {
        islandHead.style.push({ key: 'island-style-' + hash(tag.innerHTML), innerHTML: tag.innerHTML })
      }
    }
    const islandResponse: NuxtIslandResponse = {
      id: islandContext.id,
      head: islandHead,
      html: getServerComponentHTML(htmlContext.body),
      state: ssrContext.payload.state
    }

    await nitroApp.hooks.callHook('render:island', islandResponse, { event, islandContext })

    const response = {
      body: JSON.stringify(islandResponse, null, 2),
      statusCode: getResponseStatus(event),
      statusMessage: getResponseStatusText(event),
      headers: {
        'content-type': 'application/json;charset=utf-8',
        'x-powered-by': 'Nuxt'
      }
    } satisfies RenderResponse
    if (import.meta.prerender) {
      await islandCache!.setItem(`/__nuxt_island/${islandContext!.name}_${islandContext!.id}`, response)
      await islandPropCache!.setItem(`/__nuxt_island/${islandContext!.name}_${islandContext!.id}`, event.path)
    }
    return response
  }

  // Construct HTML response
  const response = {
    body: renderHTMLDocument(htmlContext),
    statusCode: getResponseStatus(event),
    statusMessage: getResponseStatusText(event),
    headers: {
      'content-type': 'text/html;charset=utf-8',
      'x-powered-by': 'Nuxt'
    }
  } satisfies RenderResponse

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

async function renderInlineStyles (usedModules: Set<string> | string[]): Promise<Style[]> {
  const styleMap = await getSSRStyles()
  const inlinedStyles = new Set<string>()
  for (const mod of usedModules) {
    if (mod in styleMap) {
      for (const style of await styleMap[mod]()) {
        inlinedStyles.add(style)
      }
    }
  }
  return Array.from(inlinedStyles).map(style => ({ innerHTML: style }))
}

function renderPayloadResponse (ssrContext: NuxtSSRContext) {
  return {
    body: process.env.NUXT_JSON_PAYLOADS
      ? stringify(splitPayload(ssrContext).payload, ssrContext._payloadReducers)
      : `export default ${devalue(splitPayload(ssrContext).payload)}`,
    statusCode: getResponseStatus(ssrContext.event),
    statusMessage: getResponseStatusText(ssrContext.event),
    headers: {
      'content-type': process.env.NUXT_JSON_PAYLOADS ? 'application/json;charset=utf-8' : 'text/javascript;charset=utf-8',
      'x-powered-by': 'Nuxt'
    }
  } satisfies RenderResponse
}

function renderPayloadJsonScript (opts: { id: string, ssrContext: NuxtSSRContext, data?: any, src?: string }): Script[] {
  const contents = opts.data ? stringify(opts.data, opts.ssrContext._payloadReducers) : ''
  const payload: Script = {
    type: 'application/json',
    id: opts.id,
    innerHTML: contents,
    'data-ssr': !(process.env.NUXT_NO_SSR || opts.ssrContext.noSSR)
  }
  if (opts.src) {
    payload['data-src'] = opts.src
  }
  return [
    payload,
    {
      innerHTML: `window.__NUXT__={};window.__NUXT__.config=${uneval(opts.ssrContext.config)}`
    }
  ]
}

function renderPayloadScript (opts: { ssrContext: NuxtSSRContext, data?: any, src?: string }): Script[] {
  opts.data.config = opts.ssrContext.config
  const _PAYLOAD_EXTRACTION = import.meta.prerender && process.env.NUXT_PAYLOAD_EXTRACTION && !opts.ssrContext.noSSR
  if (_PAYLOAD_EXTRACTION) {
    return [
      {
        type: 'module',
        innerHTML: `import p from "${opts.src}";window.__NUXT__={...p,...(${devalue(opts.data)})`
      }
    ]
  }
  return [
    {
      innerHTML: `window.__NUXT__=${devalue(opts.data)}`
    }
  ]
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

const SSR_TELEPORT_MARKER = /^uid=([^;]*);slot=(.*)$/
function replaceServerOnlyComponentsSlots (ssrContext: NuxtSSRContext, html: string): string {
  const { teleports, islandContext } = ssrContext
  if (islandContext || !teleports) { return html }
  for (const key in teleports) {
    const match = key.match(SSR_TELEPORT_MARKER)
    if (!match) { continue }
    const [, uid, slot] = match
    if (!uid || !slot) { continue }
    html = html.replace(new RegExp(`<div nuxt-ssr-component-uid="${uid}"[^>]*>((?!nuxt-ssr-slot-name="${slot}"|nuxt-ssr-component-uid)[\\s\\S])*<div [^>]*nuxt-ssr-slot-name="${slot}"[^>]*>`), (full) => {
      return full + teleports[key]
    })
  }
  return html
}
