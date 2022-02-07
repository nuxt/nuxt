import type { ServerResponse } from 'http'
import { createRenderer } from 'vue-bundle-renderer'
import devalue from '@nuxt/devalue'
import { privateConfig, publicConfig } from './config'
import { buildAssetsURL } from './paths'
// @ts-ignore
import htmlTemplate from '#build/views/document.template.mjs'

const STATIC_ASSETS_BASE = process.env.NUXT_STATIC_BASE + '/' + process.env.NUXT_STATIC_VERSION
const NUXT_NO_SSR = process.env.NUXT_NO_SSR
const PAYLOAD_JS = '/payload.js'

const getClientManifest = cachedImport(() => import('#build/dist/server/client.manifest.mjs'))
const getSSRApp = !process.env.NUXT_NO_SSR && cachedImport(() => import('#build/dist/server/server.mjs'))

const getSSRRenderer = cachedResult(async () => {
  // Load client manifest
  const clientManifest = await getClientManifest()
  if (!clientManifest) { throw new Error('client.manifest is not available') }
  // Load server bundle
  const createSSRApp = await getSSRApp()
  if (!createSSRApp) { throw new Error('Server bundle is not available') }
  // Create renderer
  const { renderToString } = await import('#nitro-renderer')
  return createRenderer((createSSRApp), { clientManifest, renderToString, publicPath: buildAssetsURL() }).renderToString
})

const getSPARenderer = cachedResult(async () => {
  const clientManifest = await getClientManifest()
  return (ssrContext) => {
    ssrContext.nuxt = {
      serverRendered: false,
      config: publicConfig
    }

    let entryFiles = Object.values(clientManifest).filter(
      (fileValue: any) => fileValue.isEntry
    )
    // https://github.com/nuxt/framework/pull/3106
    entryFiles.push(...entryFiles.flatMap((e: any) => e.dynamicImports || []).map(i => clientManifest[i]).filter(Boolean))
    if ('all' in clientManifest && 'initial' in clientManifest) {
      // Upgrade legacy manifest (also see normalizeClientManifest in vue-bundle-renderer)
      // https://github.com/nuxt-contrib/vue-bundle-renderer/issues/12
      entryFiles = clientManifest.initial.map(file => ({ file }))
    }

    return {
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
          .map(({ file }) => {
            const isMJS = !file.endsWith('.js')
            return `<script ${isMJS ? 'type="module"' : ''} src="${buildAssetsURL(file)}"></script>`
          })
          .join('')
    }
  }
})

function renderToString (ssrContext) {
  const getRenderer = (NUXT_NO_SSR || ssrContext.noSSR) ? getSPARenderer : getSSRRenderer
  return getRenderer().then(renderToString => renderToString(ssrContext))
}

export async function renderMiddleware (req, res: ServerResponse) {
  let url = req.url

  // payload.json request detection
  let isPayloadReq = false
  if (url.startsWith(STATIC_ASSETS_BASE) && url.endsWith(PAYLOAD_JS)) {
    isPayloadReq = true
    url = url.slice(STATIC_ASSETS_BASE.length, url.length - PAYLOAD_JS.length) || '/'
  }

  // Initialize ssr context
  const ssrContext = {
    url,
    req,
    res,
    runtimeConfig: { private: privateConfig, public: publicConfig },
    noSSR: req.spa || req.headers['x-nuxt-no-ssr'],
    ...(req.context || {})
  }

  // Render app
  const rendered = await renderToString(ssrContext)

  // Handle errors
  if (ssrContext.error) {
    throw ssrContext.error
  }

  if (ssrContext.redirected || res.writableEnded) {
    return
  }

  if (ssrContext.nuxt.hooks) {
    await ssrContext.nuxt.hooks.callHook('app:rendered')
  }

  // TODO: nuxt3 should not reuse `nuxt` property for different purpose!
  const payload = ssrContext.payload /* nuxt 3 */ || ssrContext.nuxt /* nuxt 2 */

  if (process.env.NUXT_FULL_STATIC) {
    payload.staticAssetsBase = STATIC_ASSETS_BASE
  }

  let data
  if (isPayloadReq) {
    data = renderPayload(payload, url)
    res.setHeader('Content-Type', 'text/javascript;charset=UTF-8')
  } else {
    data = await renderHTML(payload, rendered, ssrContext)
    res.setHeader('Content-Type', 'text/html;charset=UTF-8')
  }

  const error = ssrContext.nuxt && ssrContext.nuxt.error
  res.statusCode = error ? error.statusCode : 200
  res.end(data, 'utf-8')
}

async function renderHTML (payload, rendered, ssrContext) {
  const state = `<script>window.__NUXT__=${devalue(payload)}</script>`
  const html = rendered.html

  if ('renderMeta' in ssrContext) {
    rendered.meta = await ssrContext.renderMeta()
  }

  const {
    htmlAttrs = '',
    bodyAttrs = '',
    headAttrs = '',
    headTags = '',
    bodyScriptsPrepend = '',
    bodyScripts = ''
  } = rendered.meta || {}

  return htmlTemplate({
    HTML_ATTRS: htmlAttrs,
    HEAD_ATTRS: headAttrs,
    HEAD: headTags +
      rendered.renderResourceHints() + rendered.renderStyles() + (ssrContext.styles || ''),
    BODY_ATTRS: bodyAttrs,
    APP: bodyScriptsPrepend + html + state + rendered.renderScripts() + bodyScripts
  })
}

function renderPayload (payload, url) {
  return `__NUXT_JSONP__("${url}", ${devalue(payload)})`
}

function _interopDefault (e) {
  return e && typeof e === 'object' && 'default' in e ? e.default : e
}

function cachedImport <M> (importer: () => Promise<M>) {
  return cachedResult(() => importer().then(_interopDefault))
}

function cachedResult <T> (fn: () => Promise<T>): () => Promise<T> {
  let res = null
  return () => {
    if (res === null) {
      res = fn().catch((err) => { res = null; throw err })
    }
    return res
  }
}
