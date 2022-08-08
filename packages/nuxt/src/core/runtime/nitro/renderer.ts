import { createRenderer } from 'vue-bundle-renderer/runtime'
import type { RenderHandler, RenderResponse } from 'nitropack'
import type { Manifest } from 'vite'
import { CompatibilityEvent, getQuery } from 'h3'
import devalue from '@nuxt/devalue'
import { renderToString as _renderToString } from 'vue/server-renderer'
import type { NuxtApp } from '#app'

// @ts-ignore
import { useRuntimeConfig, useNitroApp, defineRenderHandler as _defineRenderHandler } from '#internal/nitro'
// @ts-ignore
import { buildAssetsURL } from '#paths'

export type NuxtSSRContext = NuxtApp['ssrContext']

const defineRenderHandler = _defineRenderHandler as (h: RenderHandler) => CompatibilityEvent

export interface NuxtRenderContext {
  ssrContext: NuxtSSRContext
  html: {
    htmlAttrs: string[]
    head: string[]
    bodyAttrs: string[]
    bodyPreprend: string[]
    body: string[]
    bodyAppend: string[]
  }
}

export interface NuxtRenderResponse {
  body: string,
  statusCode: number,
  statusMessage?: string,
  headers: Record<string, string>
}

// @ts-ignore
const getClientManifest: () => Promise<Manifest> = () => import('#build/dist/server/client.manifest.mjs')
  .then(r => r.default || r)
  .then(r => typeof r === 'function' ? r() : r)

// @ts-ignore
const getServerEntry = () => import('#build/dist/server/server.mjs').then(r => r.default || r)

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

  async function renderToString (input, context) {
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
    ssrContext.payload = {
      serverRendered: false,
      config: {
        public: config.public,
        app: config.app
      }
    }
    ssrContext.renderMeta = ssrContext.renderMeta ?? (() => ({}))
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
    runtimeConfig: useRuntimeConfig(),
    noSSR: !!event.req.headers['x-nuxt-no-ssr'],
    error: !!ssrError,
    nuxt: undefined, /* NuxtApp */
    payload: ssrError ? { error: ssrError } : undefined
  }

  // Render app
  const renderer = (process.env.NUXT_NO_SSR || ssrContext.noSSR) ? await getSPARenderer() : await getSSRRenderer()
  const _rendered = await renderer.renderToString(ssrContext).catch((err) => {
    if (!ssrError) { throw err }
  })

  // Handle errors
  if (!_rendered) {
    return
  }
  if (ssrContext.payload?.error && !ssrError) {
    throw ssrContext.payload.error
  }

  // Render meta
  const renderedMeta = await ssrContext.renderMeta?.() ?? {}

  // Create render context
  const rendered: NuxtRenderContext = {
    ssrContext,
    html: {
      htmlAttrs: normalizeChunks([renderedMeta.htmlAttrs]),
      head: normalizeChunks([
        renderedMeta.headTags,
        _rendered.renderResourceHints(),
        _rendered.renderStyles(),
        ssrContext.styles
      ]),
      bodyAttrs: normalizeChunks([renderedMeta.bodyAttrs]),
      bodyPreprend: normalizeChunks([
        renderedMeta.bodyScriptsPrepend,
        ssrContext.teleports?.body
      ]),
      body: [
      // TODO: Rename to _rendered.body in next vue-bundle-renderer
        _rendered.html
      ],
      bodyAppend: normalizeChunks([
      `<script>window.__NUXT__=${devalue(ssrContext.payload)}</script>`,
      _rendered.renderScripts(),
      // Note: bodyScripts may contain tags other than <script>
      renderedMeta.bodyScripts
      ])
    }
  }

  // Allow hooking into the rendered result
  const nitroApp = useNitroApp()
  await ssrContext.nuxt?.hooks.callHook('app:rendered', rendered)
  await nitroApp.hooks.callHook('nuxt:app:rendered', rendered)

  // Construct HTML response
  const response: RenderResponse = {
    body: renderHTMLDocument(rendered),
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

function normalizeChunks (chunks: string[]) {
  return chunks.filter(Boolean).map(i => i.trim())
}

function joinTags (tags: string[]) {
  return tags.join('')
}

function joinAttrs (chunks: string[]) {
  return chunks.join(' ')
}

function renderHTMLDocument (rendered: NuxtRenderContext) {
  return `<!DOCTYPE html>
<html ${joinAttrs(rendered.html.htmlAttrs)}>
<head>${joinTags(rendered.html.head)}</head>
<body ${joinAttrs(rendered.html.bodyAttrs)}>${joinTags(rendered.html.bodyPreprend)}${joinTags(rendered.html.body)}${joinTags(rendered.html.bodyAppend)}</body>
</html>`
}
