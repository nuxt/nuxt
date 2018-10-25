import path from 'path'
import crypto from 'crypto'
import devalue from '@nuxtjs/devalue'
import template from 'lodash/template'
import fs from 'fs-extra'
import { createBundleRenderer } from 'vue-server-renderer'
import consola from 'consola'

import { waitFor } from '@nuxt/common'

import SPAMetaRenderer from './spa-meta'

export default class VueRenderer {
  constructor(server) {
    this.server = server

    this.globals = this.server.globals

    // Will be set by createRenderer
    this.bundleRenderer = null
    this.spaMetaRenderer = null

    // Renderer runtime resources
    Object.assign(this.server.resources, {
      clientManifest: null,
      serverBundle: null,
      ssrTemplate: null,
      spaTemplate: null,
      errorTemplate: this.constructor.parseTemplate('Nuxt.js Internal Server Error')
    })
  }

  async ready() {
    // Production: Load SSR resources from fs
    if (!this.server.options.dev) {
      await this.loadResources()
    }
  }

  async loadResources(_fs = fs) {
    const distPath = path.resolve(this.server.options.buildDir, 'dist', 'server')
    const updated = []

    this.constructor.resourceMap.forEach(({ key, fileName, transform }) => {
      const rawKey = '$$' + key
      const _path = path.join(distPath, fileName)

      if (!_fs.existsSync(_path)) {
        return // Resource not exists
      }
      const rawData = _fs.readFileSync(_path, 'utf8')
      if (!rawData || rawData === this.server.resources[rawKey]) {
        return // No changes
      }
      this.server.resources[rawKey] = rawData
      const data = transform(rawData)
      /* istanbul ignore if */
      if (!data) {
        return // Invalid data ?
      }
      this.server.resources[key] = data
      updated.push(key)
    })

    // Reload error template
    const errorTemplatePath = path.resolve(this.server.options.buildDir, 'views/error.html')
    if (fs.existsSync(errorTemplatePath)) {
      this.server.resources.errorTemplate = this.constructor.parseTemplate(
        fs.readFileSync(errorTemplatePath, 'utf8')
      )
    }

    // Load loading template
    const loadingHTMLPath = path.resolve(this.server.options.buildDir, 'loading.html')
    if (fs.existsSync(loadingHTMLPath)) {
      this.server.resources.loadingHTML = fs.readFileSync(loadingHTMLPath, 'utf8')
      this.server.resources.loadingHTML = this.server.resources.loadingHTML
        .replace(/\r|\n|[\t\s]{3,}/g, '')
    } else {
      this.server.resources.loadingHTML = ''
    }

    // Call resourcesLoaded plugin
    await this.server.nuxt.callHook('render:resourcesLoaded', this.server.resources)

    if (updated.length > 0) {
      this.createRenderer()
    }
  }

  get noSSR() {
    return this.server.options.render.ssr === false
  }

  get isReady() {
    if (this.noSSR) {
      return Boolean(this.server.resources.spaTemplate)
    }

    return Boolean(this.bundleRenderer && this.server.resources.ssrTemplate)
  }

  get isResourcesAvailable() {
    // Required for both
    /* istanbul ignore if */
    if (!this.server.resources.clientManifest) {
      return false
    }

    // Required for SPA rendering
    if (this.noSSR) {
      return Boolean(this.server.resources.spaTemplate)
    }

    // Required for bundle renderer
    return Boolean(this.server.resources.ssrTemplate && this.server.resources.serverBundle)
  }

  createRenderer() {
    // Ensure resources are available
    if (!this.isResourcesAvailable) {
      return
    }

    // Create Meta Renderer
    this.spaMetaRenderer = new SPAMetaRenderer(this.server.nuxt, this)

    // Skip following steps if noSSR mode
    if (this.noSSR) {
      return
    }

    const hasModules = fs.existsSync(path.resolve(this.server.options.rootDir, 'node_modules'))
    // Create bundle renderer for SSR
    this.bundleRenderer = createBundleRenderer(
      this.server.resources.serverBundle,
      Object.assign(
        {
          clientManifest: this.server.resources.clientManifest,
          runInNewContext: false,
          // for globally installed nuxt command, search dependencies in global dir
          basedir: hasModules ? this.server.options.rootDir : __dirname
        },
        this.server.options.render.bundleRenderer
      )
    )
  }

  renderTemplate(ssr, opts) {
    // Fix problem with HTMLPlugin's minify option (#3392)
    opts.html_attrs = opts.HTML_ATTRS
    opts.body_attrs = opts.BODY_ATTRS

    const fn = ssr ? this.server.resources.ssrTemplate : this.server.resources.spaTemplate

    return fn(opts)
  }

  async renderRoute(url, context = {}) {
    /* istanbul ignore if */
    if (!this.isReady) {
      await waitFor(1000)
      return this.renderRoute(url, context)
    }

    // Log rendered url
    consola.debug(`Rendering url ${url}`)

    // Add url and isSever to the context
    context.url = url

    // Basic response if SSR is disabled or spa data provided
    const spa = context.spa || (context.res && context.res.spa)
    const ENV = this.server.options.env

    if (this.noSSR || spa) {
      const {
        HTML_ATTRS,
        BODY_ATTRS,
        HEAD,
        BODY_SCRIPTS,
        getPreloadFiles
      } = await this.spaMetaRenderer.render(context)
      const APP =
        `<div id="${this.globals.id}">${this.server.resources.loadingHTML}</div>` + BODY_SCRIPTS

      // Detect 404 errors
      if (
        url.includes(this.server.options.build.publicPath) ||
        url.includes('__webpack')
      ) {
        const err = {
          statusCode: 404,
          message: this.server.options.messages.error_404,
          name: 'ResourceNotFound'
        }
        throw err
      }

      const html = this.renderTemplate(false, {
        HTML_ATTRS,
        BODY_ATTRS,
        HEAD,
        APP,
        ENV
      })

      return { html, getPreloadFiles }
    }

    // Call renderToString from the bundleRenderer and generate the HTML (will update the context as well)
    let APP = await this.bundleRenderer.renderToString(context)

    if (!context.nuxt.serverRendered) {
      APP = `<div id="${this.globals.id}"></div>`
    }
    const m = context.meta.inject()
    let HEAD =
      m.title.text() +
      m.meta.text() +
      m.link.text() +
      m.style.text() +
      m.script.text() +
      m.noscript.text()
    if (this.server.options._routerBaseSpecified) {
      HEAD += `<base href="${this.server.options.router.base}">`
    }

    if (this.server.options.render.resourceHints) {
      HEAD += context.renderResourceHints()
    }

    await this.server.nuxt.callHook('render:routeContext', context.nuxt)

    const serializedSession = `window.${this.globals.context}=${devalue(context.nuxt)};`

    const cspScriptSrcHashSet = new Set()
    if (this.server.options.render.csp) {
      const { hashAlgorithm } = this.server.options.render.csp
      const hash = crypto.createHash(hashAlgorithm)
      hash.update(serializedSession)
      cspScriptSrcHashSet.add(`'${hashAlgorithm}-${hash.digest('base64')}'`)
    }

    APP += `<script>${serializedSession}</script>`
    APP += context.renderScripts()
    APP += m.script.text({ body: true })
    APP += m.noscript.text({ body: true })

    HEAD += context.renderStyles()

    const html = this.renderTemplate(true, {
      HTML_ATTRS: 'data-n-head-ssr ' + m.htmlAttrs.text(),
      BODY_ATTRS: m.bodyAttrs.text(),
      HEAD,
      APP,
      ENV
    })

    return {
      html,
      cspScriptSrcHashSet,
      getPreloadFiles: context.getPreloadFiles,
      error: context.nuxt.error,
      redirected: context.redirected
    }
  }

  static parseTemplate(templateStr) {
    return template(templateStr, {
      interpolate: /{{([\s\S]+?)}}/g
    })
  }

  static get resourceMap() {
    return [
      {
        key: 'clientManifest',
        fileName: 'vue-ssr-client-manifest.json',
        transform: JSON.parse
      },
      {
        key: 'serverBundle',
        fileName: 'server-bundle.json',
        transform: JSON.parse
      },
      {
        key: 'ssrTemplate',
        fileName: 'index.ssr.html',
        transform: this.parseTemplate
      },
      {
        key: 'spaTemplate',
        fileName: 'index.spa.html',
        transform: this.parseTemplate
      }
    ]
  }
}
