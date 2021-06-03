import { createRenderer } from 'vue-bundle-renderer'
import devalue from '@nuxt/devalue'
import config from './config'
// @ts-ignore
import htmlTemplate from '#build/views/document.template.js'

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
  const createApp = await import('#build/dist/server/server')
  // @ts-ignore
  const clientManifest = await import('#build/dist/server/client.manifest.json')
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
    runtimeConfig: {
      public: config.public,
      private: config.private
    },
    ...(req.context || {})
  }
  const renderer = await loadRenderer()
  const rendered = await renderer.renderToString(ssrContext)

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
    data = renderHTML(payload, rendered, ssrContext)
    res.setHeader('Content-Type', 'text/html;charset=UTF-8')
  }

  const error = ssrContext.nuxt && ssrContext.nuxt.error
  res.statusCode = error ? error.statusCode : 200
  res.end(data, 'utf-8')
}

function renderHTML (payload, rendered, ssrContext) {
  const state = `<script>window.__NUXT__=${devalue(payload)}</script>`
  const _html = rendered.html

  const meta = {
    htmlAttrs: '',
    bodyAttrs: '',
    headAttrs: '',
    headTags: '',
    bodyTags: '',
    bodyScriptsPrepend: '',
    bodyScripts: ''
  }

  // @vueuse/head
  if (typeof ssrContext.head === 'function') {
    Object.assign(meta, ssrContext.head())
  }

  // vue-meta
  if (ssrContext.meta && typeof ssrContext.meta.inject === 'function') {
    const _meta = ssrContext.meta.inject({
      isSSR: ssrContext.nuxt.serverRendered,
      ln: process.env.NODE_ENV === 'development'
    })
    meta.htmlAttrs += _meta.htmlAttrs.text()
    meta.headAttrs += _meta.headAttrs.text()
    meta.headTags +=
      _meta.title.text() + _meta.base.text() +
      _meta.meta.text() + _meta.link.text() +
      _meta.style.text() + _meta.script.text() +
      _meta.noscript.text()
    meta.bodyAttrs += _meta.bodyAttrs.text()
    meta.bodyScriptsPrepend =
      _meta.meta.text({ pbody: true }) + _meta.link.text({ pbody: true }) +
      _meta.style.text({ pbody: true }) + _meta.script.text({ pbody: true }) +
      _meta.noscript.text({ pbody: true })
    meta.bodyScripts =
      _meta.meta.text({ body: true }) + _meta.link.text({ body: true }) +
      _meta.style.text({ body: true }) + _meta.script.text({ body: true }) +
      _meta.noscript.text({ body: true })
  }

  return htmlTemplate({
    HTML_ATTRS: meta.htmlAttrs,
    HEAD_ATTRS: meta.headAttrs,
    HEAD: meta.headTags +
      rendered.renderResourceHints() + rendered.renderStyles() + (ssrContext.styles || ''),
    BODY_ATTRS: meta.bodyAttrs,
    BODY_SCRIPTS_PREPEND: meta.bodyScriptsPrepend,
    APP: _html + state + rendered.renderScripts(),
    BODY_SCRIPTS: meta.bodyScripts
  })
}

function renderPayload (payload, url) {
  return `__NUXT_JSONP__("${url}", ${devalue(payload)})`
}
