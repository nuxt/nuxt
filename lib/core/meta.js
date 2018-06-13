import { extname } from 'path'
import Vue from 'vue'
import VueMeta from 'vue-meta'
import { createRenderer } from 'vue-server-renderer'
import LRU from 'lru-cache'

export default class MetaRenderer {
  constructor(nuxt, renderer) {
    this.nuxt = nuxt
    this.renderer = renderer
    this.options = nuxt.options
    this.vueRenderer = createRenderer()
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
      m.title.text() +
      m.meta.text() +
      m.link.text() +
      m.style.text() +
      m.script.text() +
      m.noscript.text()

    // BODY_SCRIPTS
    meta.BODY_SCRIPTS = m.script.text({ body: true }) + m.noscript.text({ body: true })

    // Resources Hints

    meta.resourceHints = ''

    const clientManifest = this.renderer.resources.clientManifest

    const shouldPreload = this.options.render.bundleRenderer.shouldPreload
    const shouldPrefetch = this.options.render.bundleRenderer.shouldPrefetch

    if (this.options.render.resourceHints && clientManifest) {
      const publicPath = clientManifest.publicPath || '/_nuxt/'

      // Preload initial resources
      if (Array.isArray(clientManifest.initial)) {
        meta.resourceHints += clientManifest.initial
          .map(MetaRenderer.normalizeFile)
          .filter(({fileWithoutQuery, asType}) => shouldPreload(fileWithoutQuery, asType))
          .map(({ file, extension, fileWithoutQuery, asType }) => {
            let extra = ''
            if (asType === 'font') {
              extra = ` type="font/${extension}" crossorigin`
            }
            return `<link rel="preload" href="${publicPath}/${file}"${
              asType !== '' ? ` as="${asType}"` : ''}${extra}>`
          })
          .join('')
      }

      // Prefetch async resources
      if (Array.isArray(clientManifest.async)) {
        meta.resourceHints += clientManifest.async
          .map(MetaRenderer.normalizeFile)
          .filter(({fileWithoutQuery, asType}) => shouldPrefetch(fileWithoutQuery, asType))
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
      clientManifest.initial
        .filter(file => shouldPreload(file))
        .map(MetaRenderer.normalizeFile)

    // Set meta tags inside cache
    this.cache.set(url, meta)

    return meta
  }

  static normalizeFile(file) {
    const withoutQuery = file.replace(/\?.*/, '')
    const extension = extname(withoutQuery).slice(1)
    return {
      file,
      extension,
      fileWithoutQuery: withoutQuery,
      asType: MetaRenderer.getPreloadType(extension)
    }
  }

  static getPreloadType(ext) {
    if (ext === 'js') {
      return 'script'
    } else if (ext === 'css') {
      return 'style'
    } else if (/jpe?g|png|svg|gif|webp|ico/.test(ext)) {
      return 'image'
    } else if (/woff2?|ttf|otf|eot/.test(ext)) {
      return 'font'
    } else {
      return ''
    }
  }
}
