import { AsyncLocalStorage } from 'node:async_hooks'
import {
  getPrefetchLinks,
  getPreloadLinks,
  getRequestDependencies,
  renderResourceHeaders,
} from 'vue-bundle-renderer/runtime'
import type { RenderResponse } from 'nitro/types'
import type { H3Event } from 'h3'
import { appendResponseHeader, createError, getQuery, getResponseStatus, getResponseStatusText, readBody, writeEarlyHints } from 'h3'
import destr from 'destr'
import { getQuery as getURLQuery, joinURL, withoutTrailingSlash } from 'ufo'
import { createHead, propsToString, renderSSRHead } from '@unhead/vue/server'
import { resolveUnrefHeadInput } from '@unhead/vue/utils'
import type { HeadEntryOptions, Link, Script, SerializableHead, Style } from '@unhead/vue/types'

import { defineRenderHandler, getRouteRules, useNitroApp, useRuntimeConfig } from 'nitro/runtime'
import type { NuxtPayload, NuxtSSRContext } from 'nuxt/app'

import { getEntryIds, getSPARenderer, getSSRRenderer, getSSRStyles } from '../utils/build-files'
import { islandCache, islandPropCache, payloadCache, sharedPrerenderCache } from '../utils/cache'

import { renderPayloadJsonScript, renderPayloadResponse, renderPayloadScript, splitPayload } from '../utils/payload'
// @ts-expect-error virtual file
import unheadOptions from '#internal/unhead-options.mjs'
// @ts-expect-error virtual file
import { renderSSRHeadOptions } from '#internal/unhead.config.mjs'

// @ts-expect-error virtual file
import { appHead, appRootTag, appTeleportAttrs, appTeleportTag, componentIslands, appManifest as isAppManifestEnabled } from '#internal/nuxt.config.mjs'
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
  island?: boolean
  htmlAttrs: string[]
  head: string[]
  bodyAttrs: string[]
  bodyPrepend: string[]
  body: string[]
  bodyAppend: string[]
}

export interface NuxtIslandSlotResponse {
  props: Array<unknown>
  fallback?: string
}

export interface NuxtIslandClientResponse {
  html: string
  props: unknown
  chunk: string
  slots?: Record<string, string>
}

export interface NuxtIslandContext {
  id?: string
  name: string
  props?: Record<string, any>
  url?: string
  slots: Record<string, Omit<NuxtIslandSlotResponse, 'html' | 'fallback'>>
  components: Record<string, Omit<NuxtIslandClientResponse, 'html'>>
}

export interface NuxtIslandResponse {
  id?: string
  html: string
  head: SerializableHead
  props?: Record<string, Record<string, any>>
  components?: Record<string, NuxtIslandClientResponse>
  slots?: Record<string, NuxtIslandSlotResponse>
}

export interface NuxtRenderResponse {
  body: string
  statusCode: number
  statusMessage?: string
  headers: Record<string, string>
}

const ISLAND_SUFFIX_RE = /\.json(\?.*)?$/
async function getIslandContext (event: H3Event): Promise<NuxtIslandContext> {
  // TODO: Strict validation for url
  let url = event.path || ''
  if (import.meta.prerender && event.path && await islandPropCache!.hasItem(event.path)) {
    // rehydrate props from cache so we can rerender island if cache does not have it any more
    url = await islandPropCache!.getItem(event.path) as string
  }
  const componentParts = url.substring('/__nuxt_island'.length + 1).replace(ISLAND_SUFFIX_RE, '').split('_')
  const hashId = componentParts.length > 1 ? componentParts.pop() : undefined
  const componentName = componentParts.join('_')

  // TODO: Validate context
  const context = event.method === 'GET' ? getQuery(event) : await readBody(event)

  const ctx: NuxtIslandContext = {
    url: '/',
    ...context,
    id: hashId,
    name: componentName,
    props: destr(context.props) || {},
    slots: {},
    components: {},
  }

  return ctx
}

const HAS_APP_TELEPORTS = !!(appTeleportTag && appTeleportAttrs.id)
const APP_TELEPORT_OPEN_TAG = HAS_APP_TELEPORTS ? `<${appTeleportTag}${propsToString(appTeleportAttrs)}>` : ''
const APP_TELEPORT_CLOSE_TAG = HAS_APP_TELEPORTS ? `</${appTeleportTag}>` : ''

const PAYLOAD_URL_RE = process.env.NUXT_JSON_PAYLOADS ? /^[^?]*\/_payload.json(?:\?.*)?$/ : /^[^?]*\/_payload.js(?:\?.*)?$/
const PAYLOAD_FILENAME = process.env.NUXT_JSON_PAYLOADS ? '_payload.json' : '_payload.js'
const ROOT_NODE_REGEX = new RegExp(`^<${appRootTag}[^>]*>([\\s\\S]*)<\\/${appRootTag}>$`)

const PRERENDER_NO_SSR_ROUTES = new Set(['/index.html', '/200.html', '/404.html'])

export default defineRenderHandler(async (event): Promise<Partial<RenderResponse>> => {
  const nitroApp = useNitroApp()

  // Whether we're rendering an error page
  const ssrError = event.path.startsWith('/__nuxt_error')
    ? getQuery(event) as unknown as NuxtPayload['error'] & { url: string }
    : null

  if (ssrError && ssrError.statusCode) {
    ssrError.statusCode = Number.parseInt(ssrError.statusCode as any)
  }

  if (ssrError && !('__unenv__' in event.node.req) /* allow internal fetch */) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Page Not Found: /__nuxt_error',
    })
  }

  // Check for island component rendering
  const isRenderingIsland = (componentIslands as unknown as boolean && event.path.startsWith('/__nuxt_island'))
  const islandContext = isRenderingIsland ? await getIslandContext(event) : undefined

  if (import.meta.prerender && islandContext && event.path && await islandCache!.hasItem(event.path)) {
    return islandCache!.getItem(event.path) as Promise<Partial<RenderResponse>>
  }

  // Request url
  let url = ssrError?.url as string || islandContext?.url || event.path

  // Whether we are rendering payload route
  const isRenderingPayload = process.env.NUXT_PAYLOAD_EXTRACTION && !isRenderingIsland && PAYLOAD_URL_RE.test(url)
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

  const head = createHead(unheadOptions)

  // needed for hash hydration plugin to work
  const headEntryOptions: HeadEntryOptions = { mode: 'server' }
  if (!isRenderingIsland) {
    head.push(appHead, headEntryOptions)
  }

  // Initialize ssr context
  const ssrContext: NuxtSSRContext = {
    url,
    event,
    runtimeConfig: useRuntimeConfig(event) as NuxtSSRContext['runtimeConfig'],
    noSSR:
      !!(process.env.NUXT_NO_SSR) ||
      event.context.nuxt?.noSSR ||
      (routeOptions.ssr === false && !isRenderingIsland) ||
      (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
    head,
    error: !!ssrError,
    nuxt: undefined!, /* NuxtApp */
    payload: (ssrError ? { error: ssrError } : {}) as NuxtPayload,
    _payloadReducers: Object.create(null),
    modules: new Set(),
    islandContext,
  }

  if (import.meta.prerender && process.env.NUXT_SHARED_DATA) {
    ssrContext._sharedPrerenderCache = sharedPrerenderCache!
  }

  // Whether we are prerendering route
  const _PAYLOAD_EXTRACTION = import.meta.prerender && process.env.NUXT_PAYLOAD_EXTRACTION && !ssrContext.noSSR && !isRenderingIsland
  const payloadURL = _PAYLOAD_EXTRACTION ? joinURL(ssrContext.runtimeConfig.app.cdnURL || ssrContext.runtimeConfig.app.baseURL, url.replace(/\?.*$/, ''), PAYLOAD_FILENAME) + '?' + ssrContext.runtimeConfig.app.buildId : undefined
  if (import.meta.prerender) {
    ssrContext.payload.prerenderedAt = Date.now()
  }

  // Render app
  const renderer = (process.env.NUXT_NO_SSR || ssrContext.noSSR) ? await getSPARenderer() : await getSSRRenderer()

  // Render 103 Early Hints
  if (process.env.NUXT_EARLY_HINTS && !isRenderingPayload && !import.meta.prerender) {
    const { link } = renderResourceHeaders({}, renderer.rendererContext)
    if (link) {
      writeEarlyHints(event, link)
    }
  }

  if (process.env.NUXT_INLINE_STYLES && !isRenderingIsland) {
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
    appendResponseHeader(event, 'x-nitro-prerender', joinURL(url, PAYLOAD_FILENAME))
    // Use same ssr context to generate payload for this route
    await payloadCache!.setItem(withoutTrailingSlash(url), renderPayloadResponse(ssrContext))
  }

  // Render inline styles
  const inlinedStyles = (process.env.NUXT_INLINE_STYLES || isRenderingIsland)
    ? await renderInlineStyles(ssrContext.modules ?? [])
    : []

  const NO_SCRIPTS = process.env.NUXT_NO_SCRIPTS || routeOptions.noScripts

  // Setup head
  const { styles, scripts } = getRequestDependencies(ssrContext, renderer.rendererContext)
  // 1. Preload payloads and app manifest
  if (_PAYLOAD_EXTRACTION && !NO_SCRIPTS && !isRenderingIsland) {
    head.push({
      link: [
        process.env.NUXT_JSON_PAYLOADS
          ? { rel: 'preload', as: 'fetch', crossorigin: 'anonymous', href: payloadURL }
          : { rel: 'modulepreload', crossorigin: '', href: payloadURL },
      ],
    }, headEntryOptions)
  }
  if (isAppManifestEnabled && ssrContext._preloadManifest) {
    head.push({
      link: [
        { rel: 'preload', as: 'fetch', fetchpriority: 'low', crossorigin: 'anonymous', href: buildAssetsURL(`builds/meta/${ssrContext.runtimeConfig.app.buildId}.json`) },
      ],
    }, { ...headEntryOptions, tagPriority: 'low' })
  }
  // 2. Styles
  if (inlinedStyles.length) {
    head.push({ style: inlinedStyles })
  }
  if (!isRenderingIsland || import.meta.dev) {
    const link: Link[] = []
    for (const resource of Object.values(styles)) {
      // Do not add links to resources that are inlined (vite v5+)
      if (import.meta.dev && 'inline' in getURLQuery(resource.file)) {
        continue
      }
      // Add CSS links in <head> for CSS files
      // - in production
      // - in dev mode when not rendering an island
      // - in dev mode when rendering an island and the file has scoped styles and is not a page
      if (!import.meta.dev || !isRenderingIsland || (resource.file.includes('scoped') && !resource.file.includes('pages/'))) {
        link.push({ rel: 'stylesheet', href: renderer.rendererContext.buildAssetsURL(resource.file), crossorigin: '' })
      }
    }
    if (link.length) {
      head.push({ link }, headEntryOptions)
    }
  }

  // 3. Response for component islands
  if (isRenderingIsland && islandContext) {
    const islandHead: SerializableHead = {}
    for (const entry of head.entries.values()) {
      for (const [key, value] of Object.entries(resolveUnrefHeadInput(entry.input as any) as SerializableHead)) {
        const currentValue = islandHead[key as keyof SerializableHead]
        if (Array.isArray(currentValue)) {
          currentValue.push(...value)
        }
        islandHead[key as keyof SerializableHead] = value
      }
    }

    // TODO: remove for v4
    islandHead.link ||= []
    islandHead.style ||= []

    const islandResponse: NuxtIslandResponse = {
      id: islandContext.id,
      head: islandHead,
      html: getServerComponentHTML(_rendered.html),
      components: getClientIslandResponse(ssrContext),
      slots: getSlotIslandResponse(ssrContext),
    }

    await nitroApp.hooks.callHook('render:island', islandResponse, { event, islandContext })

    const response = {
      body: JSON.stringify(islandResponse, null, 2),
      statusCode: getResponseStatus(event),
      statusMessage: getResponseStatusText(event),
      headers: {
        'content-type': 'application/json;charset=utf-8',
        'x-powered-by': 'Nuxt',
      },
    } satisfies RenderResponse
    if (import.meta.prerender) {
      await islandCache!.setItem(`/__nuxt_island/${islandContext!.name}_${islandContext!.id}.json`, response)
      await islandPropCache!.setItem(`/__nuxt_island/${islandContext!.name}_${islandContext!.id}.json`, event.path)
    }
    return response
  }

  if (!NO_SCRIPTS) {
    // 4. Resource Hints
    // TODO: add priorities based on Capo
    head.push({
      link: getPreloadLinks(ssrContext, renderer.rendererContext) as Link[],
    }, headEntryOptions)
    head.push({
      link: getPrefetchLinks(ssrContext, renderer.rendererContext) as Link[],
    }, headEntryOptions)
    // 5. Payloads
    head.push({
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
    head.push({
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

  // remove certain tags for nuxt islands
  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = await renderSSRHead(head, renderSSRHeadOptions)

  // Create render context
  const htmlContext: NuxtRenderHTMLContext = {
    island: isRenderingIsland,
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
  const response = {
    body: renderHTMLDocument(htmlContext),
    statusCode: getResponseStatus(event),
    statusMessage: getResponseStatusText(event),
    headers: {
      'content-type': 'text/html;charset=utf-8',
      'x-powered-by': 'Nuxt',
    },
  } satisfies RenderResponse

  return response
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

async function renderInlineStyles (usedModules: Set<string> | string[]): Promise<Style[]> {
  const styleMap = await getSSRStyles()
  const inlinedStyles = new Set<string>()
  for (const mod of usedModules) {
    if (mod in styleMap && styleMap[mod]) {
      for (const style of await styleMap[mod]()) {
        inlinedStyles.add(style)
      }
    }
  }
  return Array.from(inlinedStyles).map(style => ({ innerHTML: style }))
}

/**
 * remove the root node from the html body
 */
function getServerComponentHTML (body: string): string {
  const match = body.match(ROOT_NODE_REGEX)
  return match?.[1] || body
}

const SSR_SLOT_TELEPORT_MARKER = /^uid=([^;]*);slot=(.*)$/
const SSR_CLIENT_TELEPORT_MARKER = /^uid=([^;]*);client=(.*)$/
const SSR_CLIENT_SLOT_MARKER = /^island-slot=([^;]*);(.*)$/

function getSlotIslandResponse (ssrContext: NuxtSSRContext): NuxtIslandResponse['slots'] {
  if (!ssrContext.islandContext || !Object.keys(ssrContext.islandContext.slots).length) { return undefined }
  const response: NuxtIslandResponse['slots'] = {}
  for (const [name, slot] of Object.entries(ssrContext.islandContext.slots)) {
    response[name] = {
      ...slot,
      fallback: ssrContext.teleports?.[`island-fallback=${name}`],
    }
  }
  return response
}

function getClientIslandResponse (ssrContext: NuxtSSRContext): NuxtIslandResponse['components'] {
  if (!ssrContext.islandContext || !Object.keys(ssrContext.islandContext.components).length) { return undefined }
  const response: NuxtIslandResponse['components'] = {}

  for (const [clientUid, component] of Object.entries(ssrContext.islandContext.components)) {
    // remove teleport anchor to avoid hydration issues
    const html = ssrContext.teleports?.[clientUid]?.replaceAll('<!--teleport start anchor-->', '') || ''
    response[clientUid] = {
      ...component,
      html,
      slots: getComponentSlotTeleport(clientUid, ssrContext.teleports ?? {}),
    }
  }
  return response
}

function getComponentSlotTeleport (clientUid: string, teleports: Record<string, string>) {
  const entries = Object.entries(teleports)
  const slots: Record<string, string> = {}

  for (const [key, value] of entries) {
    const match = key.match(SSR_CLIENT_SLOT_MARKER)
    if (match) {
      const [, id, slot] = match
      if (!slot || clientUid !== id) { continue }
      slots[slot] = value
    }
  }
  return slots
}

function replaceIslandTeleports (ssrContext: NuxtSSRContext, html: string) {
  const { teleports, islandContext } = ssrContext

  if (islandContext || !teleports) { return html }
  for (const key in teleports) {
    const matchClientComp = key.match(SSR_CLIENT_TELEPORT_MARKER)
    if (matchClientComp) {
      const [, uid, clientId] = matchClientComp
      if (!uid || !clientId) { continue }
      html = html.replace(new RegExp(` data-island-uid="${uid}" data-island-component="${clientId}"[^>]*>`), (full) => {
        return full + teleports[key]
      })
      continue
    }
    const matchSlot = key.match(SSR_SLOT_TELEPORT_MARKER)
    if (matchSlot) {
      const [, uid, slot] = matchSlot
      if (!uid || !slot) { continue }
      html = html.replace(new RegExp(` data-island-uid="${uid}" data-island-slot="${slot}"[^>]*>`), (full) => {
        return full + teleports[key]
      })
    }
  }
  return html
}
