import { extname } from 'path'
import cloneDeep from 'lodash/cloneDeep'
import VueMeta from 'vue-meta'
import LRU from 'lru-cache'
import devalue from '@nuxt/devalue'

import { TARGETS, isModernRequest } from 'nuxt/utils'
import ServerContext from 'nuxt/server/context'
import BaseRenderer from './base'

export default class SPARenderer extends BaseRenderer {
  cache: LRU<unknown, unknown>
  vueMetaConfig: {
    ssrAppId: string
    keyName: string
    attribute: string
    ssrAttribute: string
    tagIDKeyName: string
  }

  constructor (serverContext: ServerContext) {
    super(serverContext)

    this.cache = new LRU()

    this.vueMetaConfig = {
      ssrAppId: '1',
      ...this.options.vueMeta,
      keyName: 'head',
      attribute: 'data-n-head',
      ssrAttribute: 'data-n-head-ssr',
      tagIDKeyName: 'hid'
    }
  }

  async render (renderContext) {
    const { url = '/', req = {} } = renderContext
    const modernMode = this.options.modern
    const modern = (modernMode && this.options.target === TARGETS.static) || isModernRequest(req, modernMode)
    const cacheKey = `${modern ? 'modern:' : 'legacy:'}${url}`
    let meta = this.cache.get(cacheKey)

    if (meta) {
      // Return a copy of the content, so that future
      // modifications do not effect the data in cache
      return cloneDeep(meta)
    }

    meta = {
      HTML_ATTRS: '',
      HEAD_ATTRS: '',
      BODY_ATTRS: '',
      HEAD: '',
      BODY_SCRIPTS_PREPEND: '',
      BODY_SCRIPTS: ''
    }

    if (this.options.features.meta) {
      // Get vue-meta context
      let head
      if (typeof this.options.head === 'function') {
        head = this.options.head()
      } else {
        head = cloneDeep(this.options.head)
      }

      const m = VueMeta.generate(head || {}, this.vueMetaConfig)

      // HTML_ATTRS
      meta.HTML_ATTRS = m.htmlAttrs.text()

      // HEAD_ATTRS
      meta.HEAD_ATTRS = m.headAttrs.text()

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

      // Add <base href=""> meta if router base specified
      if (this.options._routerBaseSpecified) {
        meta.HEAD += `<base href="${this.options.router.base}">`
      }

      // BODY_SCRIPTS (PREPEND)
      meta.BODY_SCRIPTS_PREPEND =
        m.meta.text({ pbody: true }) +
        m.link.text({ pbody: true }) +
        m.style.text({ pbody: true }) +
        m.script.text({ pbody: true }) +
        m.noscript.text({ pbody: true })

      // BODY_SCRIPTS (APPEND)
      meta.BODY_SCRIPTS =
        m.meta.text({ body: true }) +
        m.link.text({ body: true }) +
        m.style.text({ body: true }) +
        m.script.text({ body: true }) +
        m.noscript.text({ body: true })
    }

    // Resources Hints
    meta.resourceHints = ''

    const { resources: { modernManifest, clientManifest } } = this.serverContext
    const manifest = modern ? modernManifest : clientManifest

    const { shouldPreload, shouldPrefetch } = this.options.render.bundleRenderer

    if (this.options.render.resourceHints && manifest) {
      const publicPath = manifest.publicPath || '/_nuxt/'

      // Preload initial resources
      if (Array.isArray(manifest.initial)) {
        const { crossorigin } = this.options.render
        const cors = `${crossorigin ? ` crossorigin="${crossorigin}"` : ''}`

        meta.preloadFiles = manifest.initial
          .map(SPARenderer.normalizeFile)
          .filter(({ fileWithoutQuery, asType }) => shouldPreload(fileWithoutQuery, asType))
          .map(file => ({ ...file, modern }))

        meta.resourceHints += meta.preloadFiles
          .map(({ file, extension, fileWithoutQuery, asType, modern }) => {
            let extra = ''
            if (asType === 'font') {
              extra = ` type="font/${extension}"${cors ? '' : ' crossorigin'}`
            }
            const rel = modern && asType === 'script' ? 'modulepreload' : 'preload'
            return `<link rel="${rel}"${cors} href="${publicPath}${file}"${
              asType !== '' ? ` as="${asType}"` : ''}${extra}>`
          })
          .join('')
      }

      // Prefetch async resources
      if (Array.isArray(manifest.async)) {
        meta.resourceHints += manifest.async
          .map(SPARenderer.normalizeFile)
          .filter(({ fileWithoutQuery, asType }) => shouldPrefetch(fileWithoutQuery, asType))
          .map(({ file }) => `<link rel="prefetch" href="${publicPath}${file}">`)
          .join('')
      }

      // Add them to HEAD
      if (meta.resourceHints) {
        meta.HEAD += meta.resourceHints
      }
    }

    // Serialize state (runtime config)
    let APP = `${meta.BODY_SCRIPTS_PREPEND}<div id="${this.serverContext.globals.id}">${this.serverContext.resources.loadingHTML}</div>${meta.BODY_SCRIPTS}`

    APP += `<script>window.${this.serverContext.globals.context}=${devalue({
      config: renderContext.runtimeConfig.public,
      staticAssetsBase: renderContext.staticAssetsBase
    })}</script>`

    // Prepare template params
    const templateParams = {
      ...meta,
      APP,
      ENV: this.options.env
    }

    // Call spa:templateParams hook
    await this.serverContext.nuxt.callHook('vue-renderer:spa:templateParams', templateParams)

    // Render with SPA template
    const html = this.renderTemplate(this.serverContext.resources.spaTemplate, templateParams)
    const content = {
      html,
      preloadFiles: meta.preloadFiles || []
    }

    // Set meta tags inside cache
    this.cache.set(cacheKey, content)

    // Return a copy of the content, so that future
    // modifications do not effect the data in cache
    return cloneDeep(content)
  }

  static normalizeFile (file) {
    const withoutQuery = file.replace(/\?.*/, '')
    const extension = extname(withoutQuery).slice(1)
    return {
      file,
      extension,
      fileWithoutQuery: withoutQuery,
      asType: SPARenderer.getPreloadType(extension)
    }
  }

  static getPreloadType (ext: string) {
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
