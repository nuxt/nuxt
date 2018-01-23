const Vue = require('vue')
const VueMeta = require('vue-meta')
const VueServerRenderer = require('vue-server-renderer')
const LRU = require('lru-cache')

module.exports = class MetaRenderer {
  constructor(nuxt, renderer) {
    this.nuxt = nuxt
    this.renderer = renderer
    this.options = nuxt.options
    this.vueRenderer = VueServerRenderer.createRenderer()
    this.cache = LRU({})

    // Add VueMeta to Vue (this is only for SPA mode)
    // See lib/app/index.js
    Vue.use(VueMeta, {
      keyName: 'head',
      attribute: 'data-n-head',
      ssrAttribute: 'data-n-head-ssr',
      tagIDKeyName: 'hid'
    })
  }

  async getMeta(url) {
    const vm = new Vue({
      render: h => h(), // Render empty html tag
      head: this.options.head || {}
    })
    await this.vueRenderer.renderToString(vm)
    return vm.$meta().inject()
  }

  async render({ url = '/' }) {
    let meta = this.cache.get(url)

    if (meta) {
      return meta
    }

    meta = {
      HTML_ATTRS: '',
      BODY_ATTRS: '',
      HEAD: '',
      BODY_SCRIPTS: ''
    }
    // Get vue-meta context
    const m = await this.getMeta(url)
    // HTML_ATTRS
    meta.HTML_ATTRS = m.htmlAttrs.text()
    // BODY_ATTRS
    meta.BODY_ATTRS = m.bodyAttrs.text()
    // HEAD tags
    meta.HEAD =
      m.meta.text() +
      m.title.text() +
      m.link.text() +
      m.style.text() +
      m.script.text() +
      m.noscript.text()
    // BODY_SCRIPTS
    meta.BODY_SCRIPTS = m.script.text({ body: true }) + m.noscript.text({ body: true })
    // Resources Hints
    meta.resourceHints = ''
    // Resource Hints
    const clientManifest = this.renderer.resources.clientManifest
    if (this.options.render.resourceHints && clientManifest) {
      const publicPath = clientManifest.publicPath || '/_nuxt/'
      // Pre-Load initial resources
      if (Array.isArray(clientManifest.initial)) {
        meta.resourceHints += clientManifest.initial
          .map(
            r => `<link rel="preload" href="${publicPath}${r}" as="script" />`
          )
          .join('')
      }
      // Pre-Fetch async resources
      if (Array.isArray(clientManifest.async)) {
        meta.resourceHints += clientManifest.async
          .map(r => `<link rel="prefetch" href="${publicPath}${r}" />`)
          .join('')
      }
      // Add them to HEAD
      if (meta.resourceHints) {
        meta.HEAD += meta.resourceHints
      }
    }

    // Emulate getPreloadFiles from vue-server-renderer (works for JS chunks only)
    meta.getPreloadFiles = () =>
      clientManifest.initial.map(r => ({
        file: r,
        fileWithoutQuery: r,
        asType: 'script',
        extension: 'js'
      }))

    // Set meta tags inside cache
    this.cache.set(url, meta)

    return meta
  }
}
