import { createRenderer } from 'vue-bundle-renderer'
import devalue from '@nuxt/devalue'
import { runtimeConfig } from './config'
// @ts-ignore
import htmlTemplate from '#build/views/document.template.mjs'

function _interopDefault (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e }

const STATIC_ASSETS_BASE = process.env.NUXT_STATIC_BASE + '/' + process.env.NUXT_STATIC_VERSION
const PAYLOAD_JS = '/payload.js'

let _renderer
async function loadRenderer () {
  if (_renderer) {
    return _renderer
  }
  // @ts-ignore
  const { renderToString } = await import('#nitro-renderer')
  // @ts-ignore
  const createApp = await import('#build/dist/server/server.mjs')
  // @ts-ignore
  const clientManifest = await import('#build/dist/server/client.manifest.mjs')
  _renderer = createRenderer(_interopDefault(createApp), {
    clientManifest: _interopDefault(clientManifest),
    renderToString
  })
  return _renderer
}

export async function renderMiddleware (req, res) {
  let url = req.url

  // payload.json request detection
  let isPayloadReq = false
  if (url.startsWith(STATIC_ASSETS_BASE) && url.endsWith(PAYLOAD_JS)) {
    isPayloadReq = true
    url = url.substr(STATIC_ASSETS_BASE.length, url.length - STATIC_ASSETS_BASE.length - PAYLOAD_JS.length)
  }

  const ssrContext = {
    url,
    req,
    res,
    runtimeConfig,
    ...(req.context || {})
  }
  const renderer = await loadRenderer()
  const rendered = await renderer.renderToString(ssrContext)

  // Handle errors
  if (ssrContext.error) {
    throw ssrContext.error
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
