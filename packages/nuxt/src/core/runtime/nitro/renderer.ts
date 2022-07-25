import { createRenderer } from 'vue-bundle-renderer'
import { eventHandler, useQuery } from 'h3'
import devalue from '@nuxt/devalue'
import { renderToString as _renderToString } from 'vue/server-renderer'

import type { NuxtApp } from '#app'

// @ts-ignore
import { useRuntimeConfig } from '#internal/nitro'
// @ts-ignore
import { buildAssetsURL } from '#paths'
// @ts-ignore
import htmlTemplate from '#build/views/document.template.mjs'

type NuxtSSRContext = NuxtApp['ssrContext']

interface RenderResult {
  html: any
  renderResourceHints: () => string
  renderStyles: () => string
  renderScripts: () => string
  meta?: Partial<{
    htmlAttrs?: string,
    bodyAttrs: string,
    headAttrs: string,
    headTags: string,
    bodyScriptsPrepend : string,
    bodyScripts : string
  }>
}

// @ts-ignore
const getClientManifest = () => import('#build/dist/server/client.manifest.mjs')
  .then(r => r.default || r)
  .then(r => typeof r === 'function' ? r() : r)

// @ts-ignore
const getServerEntry = () => import('#build/dist/server/server.mjs').then(r => r.default || r)

// -- SSR Renderer --
const getSSRRenderer = lazyCachedFunction(async () => {
  // Load client manifest
  const clientManifest = await getClientManifest()
  if (!clientManifest) { throw new Error('client.manifest is not available') }

  // Load server bundle
  const createSSRApp = await getServerEntry()
  if (!createSSRApp) { throw new Error('Server bundle is not available') }

  // Create renderer
  const renderer = createRenderer(createSSRApp, {
    clientManifest,
    renderToString,
    publicPath: buildAssetsURL()
  })

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
  const clientManifest = await getClientManifest()
  const renderToString = (ssrContext: NuxtSSRContext) => {
    const config = useRuntimeConfig()
    ssrContext.payload = {
      serverRendered: false,
      config: {
        public: config.public,
        app: config.app
      }
    }

    let entryFiles = Object.values(clientManifest).filter((fileValue: any) => fileValue.isEntry)
    if ('all' in clientManifest && 'initial' in clientManifest) {
      // Upgrade legacy manifest (also see normalizeClientManifest in vue-bundle-renderer)
      // https://github.com/nuxt-contrib/vue-bundle-renderer/issues/12
      entryFiles = clientManifest.initial.map(file =>
        // Webpack manifest fix with SPA renderer
        file.endsWith('css') ? { css: file } : { file }
      )
    }

    return Promise.resolve({
      html: '<div id="__nuxt"></div>',
      renderResourceHints: () => '',
      renderStyles: () =>
        entryFiles
          .flatMap(({ css }) => css)
          .filter(css => css != null)
          .map(file => `<link rel="stylesheet" href="${buildAssetsURL(file)}">`)
          .join(''),
      renderScripts: () =>
        entryFiles
          .filter(({ file }) => file)
          .map(({ file }) => {
            const isMJS = !file.endsWith('.js')
            return `<script ${isMJS ? 'type="module"' : ''} src="${buildAssetsURL(file)}"></script>`
          })
          .join('')
    })
  }

  return { renderToString }
})

export default eventHandler(async (event) => {
  // Whether we're rendering an error page
  const ssrError = event.req.url?.startsWith('/__nuxt_error') ? useQuery(event) : null
  const url = ssrError?.url as string || event.req.url!

  // Initialize ssr context
  const ssrContext: NuxtSSRContext = {
    url,
    event,
    req: event.req,
    res: event.res,
    runtimeConfig: useRuntimeConfig(),
    noSSR: !!event.req.headers['x-nuxt-no-ssr'],
    error: ssrError,
    nuxt: undefined, /* NuxtApp */
    payload: undefined
  }

  // Render app
  const renderer = (process.env.NUXT_NO_SSR || ssrContext.noSSR) ? await getSPARenderer() : await getSSRRenderer()
  const rendered = await renderer.renderToString(ssrContext).catch((e) => {
    if (!ssrError) { throw e }
  }) as RenderResult

  // If we error on rendering error page, we bail out and directly return to the error handler
  if (!rendered) { return }

  if (event.res.writableEnded) {
    return
  }

  // Handle errors
  if (ssrContext.error && !ssrError) {
    throw ssrContext.error
  }

  if (ssrContext.nuxt?.hooks) {
    await ssrContext.nuxt.hooks.callHook('app:rendered')
  }

  const html = await renderHTML(ssrContext.payload, rendered, ssrContext)
  event.res.setHeader('Content-Type', 'text/html;charset=UTF-8')
  return html
})

async function renderHTML (payload: any, rendered: RenderResult, ssrContext: NuxtSSRContext) {
  const state = `<script>window.__NUXT__=${devalue(payload)}</script>`

  rendered.meta = rendered.meta || {}
  if (ssrContext.renderMeta) {
    Object.assign(rendered.meta, await ssrContext.renderMeta())
  }

  return htmlTemplate({
    HTML_ATTRS: (rendered.meta.htmlAttrs || ''),
    HEAD_ATTRS: (rendered.meta.headAttrs || ''),
    HEAD: (rendered.meta.headTags || '') +
      rendered.renderResourceHints() + rendered.renderStyles() + (ssrContext.styles || ''),
    BODY_ATTRS: (rendered.meta.bodyAttrs || ''),
    BODY_PREPEND: (ssrContext.teleports?.body || ''),
    APP: (rendered.meta.bodyScriptsPrepend || '') + rendered.html + state + rendered.renderScripts() + (rendered.meta.bodyScripts || '')
  })
}

function lazyCachedFunction <T> (fn: () => Promise<T>): () => Promise<T> {
  let res: Promise<T> | null = null
  return () => {
    if (res === null) {
      res = fn().catch((err) => { res = null; throw err })
    }
    return res
  }
}
