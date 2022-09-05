import { createRenderer } from 'vue-bundle-renderer/runtime'
import type { RenderResponse } from 'nitropack'
import type { Manifest } from 'vite'
import { getQuery } from 'h3'
import devalue from '@nuxt/devalue'
import { renderToString as _renderToString } from 'vue/server-renderer'
import { useRuntimeConfig, useNitroApp, defineRenderHandler } from '#internal/nitro'
// eslint-disable-next-line import/no-restricted-paths
import type { NuxtApp, NuxtSSRContext } from '#app'

// @ts-ignore
import { buildAssetsURL } from '#paths'

export interface NuxtRenderHTMLContext {
  htmlAttrs: string[]
  head: string[]
  bodyAttrs: string[]
  bodyPreprend: string[]
  body: string[]
  bodyAppend: string[]
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
const getServerEntry = () => import('#build/dist/server/server.mjs').then(r => r.default || r)

// @ts-ignore
const getSSRStyles = (): Promise<Record<string, () => Promise<string[]>>> => import('#build/dist/server/styles.mjs').then(r => r.default || r)

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
    return `<div id="__nuxt">${html}</div>`
  }

  return renderer
})

// -- SPA Renderer --
const getSPARenderer = lazyCachedFunction(async () => {
  const manifest = await getClientManifest()

  const options = {
    manifest,
    renderToString: () => '<div id="__nuxt"></div>',
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
    ssrContext!.renderMeta = ssrContext!.renderMeta ?? (() => ({}))
    return Promise.resolve(result)
  }

  return { renderToString }
})

export default defineRenderHandler(async (event) => {
  // Whether we're rendering an error page
  const ssrError = event.req.url?.startsWith('/__nuxt_error') ? getQuery(event) as Exclude<NuxtApp['payload']['error'], Error> : null
  const url = ssrError?.url as string || event.req.url!

  // Initialize ssr context
  const ssrContext: NuxtSSRContext = {
    url,
    event,
    req: event.req,
    res: event.res,
    runtimeConfig: useRuntimeConfig() as NuxtSSRContext['runtimeConfig'],
    noSSR: !!event.req.headers['x-nuxt-no-ssr'],
    error: !!ssrError,
    nuxt: undefined!, /* NuxtApp */
    payload: ssrError ? { error: ssrError } as NuxtSSRContext['payload'] : undefined!
  }

  // Render app
  const renderer = (process.env.NUXT_NO_SSR || ssrContext.noSSR) ? await getSPARenderer() : await getSSRRenderer()
  const _rendered = await renderer.renderToString(ssrContext).catch((err) => {
    if (!ssrError) {
      throw err
    }
  })
  await ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext })

  // Handle errors
  if (!_rendered) {
    return undefined!
  }
  if (ssrContext.payload?.error && !ssrError) {
    throw ssrContext.payload.error
  }

  // Render meta
  const renderedMeta = await ssrContext.renderMeta?.() ?? {}

  // Render inline styles
  const inlinedStyles = process.env.NUXT_INLINE_STYLES
    ? await renderInlineStyles(ssrContext.modules ?? ssrContext._registeredComponents ?? [])
    : ''

  // Create render context
  const htmlContext: NuxtRenderHTMLContext = {
    htmlAttrs: normalizeChunks([renderedMeta.htmlAttrs]),
    head: normalizeChunks([
      renderedMeta.headTags,
      _rendered.renderResourceHints(),
      _rendered.renderStyles(),
      inlinedStyles,
      ssrContext.styles
    ]),
    bodyAttrs: normalizeChunks([renderedMeta.bodyAttrs!]),
    bodyPreprend: normalizeChunks([
      renderedMeta.bodyScriptsPrepend,
      ssrContext.teleports?.body
    ]),
    body: [
      // TODO: Rename to _rendered.body in next vue-bundle-renderer
      _rendered.html
    ],
    bodyAppend: normalizeChunks([
      process.env.NUXT_NO_SCRIPTS ? '' : `<script>window.__NUXT__=${devalue(ssrContext.payload)}</script>`,
      process.env.NUXT_NO_SCRIPTS ? '' : _rendered.renderScripts(),
      // Note: bodyScripts may contain tags other than <script>
      renderedMeta.bodyScripts
    ])
  }

  // Allow hooking into the rendered result
  const nitroApp = useNitroApp()
  await nitroApp.hooks.callHook('render:html', htmlContext, { event })

  // Construct HTML response
  const response: RenderResponse = {
    body: renderHTMLDocument(htmlContext),
    statusCode: event.res.statusCode,
    statusMessage: event.res.statusMessage,
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'X-Powered-By': 'Nuxt'
    }
  }

  return response
})

function lazyCachedFunction <T> (fn: () => Promise<T>): () => Promise<T> {
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
<body ${joinAttrs(html.bodyAttrs)}>${joinTags(html.bodyPreprend)}${joinTags(html.body)}${joinTags(html.bodyAppend)}</body>
</html>`
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
