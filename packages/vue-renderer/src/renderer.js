import path from 'path'
import crypto from 'crypto'
import fs from 'fs-extra'
import consola from 'consola'
import devalue from '@nuxtjs/devalue'
import invert from 'lodash/invert'
import template from 'lodash/template'
import { waitFor } from '@nuxt/common'
import { createBundleRenderer } from 'vue-server-renderer'

import SPAMetaRenderer from './spa-meta'

export default class VueRenderer {
  constructor(context) {
    this.context = context

    // Will be set by createRenderer
    this.renderer = {
      ssr: null,
      modern: null,
      spa: null
    }

    // Renderer runtime resources
    Object.assign(this.context.resources, {
      clientManifest: null,
      modernManifest: null,
      serverBundle: null,
      ssrTemplate: null,
      spaTemplate: null,
      errorTemplate: this.constructor.parseTemplate('Nuxt.js Internal Server Error')
    })
  }

  get assetsMapping() {
    if (this._assetsMapping) return this._assetsMapping

    const legacyAssets = this.context.resources.clientManifest.assetsMapping
    const modernAssets = invert(this.context.resources.modernManifest.assetsMapping)
    const mapping = {}
    for (const legacyJsFile in legacyAssets) {
      const chunkNamesHash = legacyAssets[legacyJsFile]
      mapping[legacyJsFile] = modernAssets[chunkNamesHash]
    }
    delete this.context.resources.clientManifest.assetsMapping
    delete this.context.resources.modernManifest.assetsMapping
    this._assetsMapping = mapping
    return mapping
  }

  renderScripts(context) {
    if (this.context.options.modern === 'client') {
      const publicPath = this.context.options.build.publicPath
      const scriptPattern = /<script[^>]*?src="([^"]*)"[^>]*>[^<]*<\/script>/g
      return context.renderScripts().replace(scriptPattern, (scriptTag, jsFile) => {
        const legacyJsFile = jsFile.replace(publicPath, '')
        const modernJsFile = this.assetsMapping[legacyJsFile]
        const moduleTag = scriptTag.replace('<script', '<script type="module"').replace(legacyJsFile, modernJsFile)
        const noModuleTag = scriptTag.replace('<script', '<script nomodule')
        return noModuleTag + moduleTag
      })
    }
    return context.renderScripts()
  }

  renderResourceHints(context) {
    if (this.context.options.modern === 'client') {
      const modulePreloadTags = []
      for (const legacyJsFile of context.getPreloadFiles()) {
        if (legacyJsFile.asType === 'script') {
          const publicPath = this.context.options.build.publicPath
          const modernJsFile = this.assetsMapping[legacyJsFile.file]
          modulePreloadTags.push(`<link rel="modulepreload" href="${publicPath}${modernJsFile}" as="script">`)
        }
      }
      return modulePreloadTags.join('')
    }
    return context.renderResourceHints()
  }

  async ready() {
    // Production: Load SSR resources from fs
    if (!this.context.options.dev) {
      await this.loadResources()
    }
  }

  async loadResources(_fs = fs) {
    const distPath = path.resolve(this.context.options.buildDir, 'dist', 'server')
    const updated = []

    this.constructor.resourceMap.forEach(({ key, fileName, transform }) => {
      const rawKey = '$$' + key
      const _path = path.join(distPath, fileName)

      // Fail when no build found and using programmatic usage
      if (!_fs.existsSync(_path)) {
        // TODO: Enable baack when renderer initialzation was disabled for build only scripts
        // Currently this breaks normal nuxt build for first time
        // if (!this.context.options.dev) {
        //   const invalidSSR = !this.noSSR && key === 'serverBundle'
        //   const invalidSPA = this.noSSR && key === 'spaTemplate'
        //   if (invalidSPA || invalidSSR) {
        //     consola.fatal(`Could not load Nuxt renderer, make sure to build for production: builder.build() with dev option set to false.`)
        //   }
        // }
        return // Resource not exists
      }

      const rawData = _fs.readFileSync(_path, 'utf8')
      if (!rawData || rawData === this.context.resources[rawKey]) {
        return // No changes
      }
      this.context.resources[rawKey] = rawData
      const data = transform(rawData)
      /* istanbul ignore if */
      if (!data) {
        return // Invalid data ?
      }
      this.context.resources[key] = data
      updated.push(key)
    })

    // Reload error template
    const errorTemplatePath = path.resolve(this.context.options.buildDir, 'views/error.html')
    if (fs.existsSync(errorTemplatePath)) {
      this.context.resources.errorTemplate = this.constructor.parseTemplate(
        fs.readFileSync(errorTemplatePath, 'utf8')
      )
    }

    // Load loading template
    const loadingHTMLPath = path.resolve(this.context.options.buildDir, 'loading.html')
    if (fs.existsSync(loadingHTMLPath)) {
      this.context.resources.loadingHTML = fs.readFileSync(loadingHTMLPath, 'utf8')
      this.context.resources.loadingHTML = this.context.resources.loadingHTML
        .replace(/\r|\n|[\t\s]{3,}/g, '')
    } else {
      this.context.resources.loadingHTML = ''
    }

    // Call resourcesLoaded plugin
    await this.context.nuxt.callHook('render:resourcesLoaded', this.context.resources)

    if (updated.length > 0) {
      this.createRenderer()
    }
  }

  get noSSR() {
    return this.context.options.render.ssr === false
  }

  get isReady() {
    if (this.noSSR) {
      return Boolean(this.context.resources.spaTemplate)
    }

    return Boolean(this.renderer.ssr && this.context.resources.ssrTemplate)
  }

  get isResourcesAvailable() {
    // Required for both
    /* istanbul ignore if */
    if (!this.context.resources.clientManifest) {
      return false
    }

    // Required for SPA rendering
    if (this.noSSR) {
      return Boolean(this.context.resources.spaTemplate)
    }

    // Required for bundle renderer
    return Boolean(this.context.resources.ssrTemplate && this.context.resources.serverBundle)
  }

  createRenderer() {
    // Ensure resources are available
    if (!this.isResourcesAvailable) {
      return
    }

    // Create Meta Renderer
    this.renderer.spa = new SPAMetaRenderer(this)

    // Skip following steps if noSSR mode
    if (this.noSSR) {
      return
    }

    const hasModules = fs.existsSync(path.resolve(this.context.options.rootDir, 'node_modules'))
    const rendererOptions = {
      runInNewContext: false,
      clientManifest: this.context.resources.clientManifest,
      // for globally installed nuxt command, search dependencies in global dir
      basedir: hasModules ? this.context.options.rootDir : __dirname,
      ...this.context.options.render.bundleRenderer
    }

    // Create bundle renderer for SSR
    this.renderer.ssr = createBundleRenderer(
      this.context.resources.serverBundle,
      rendererOptions
    )

    if (this.context.options.modern === 'server') {
      this.renderer.modern = createBundleRenderer(
        this.context.resources.serverBundle,
        {
          ...rendererOptions,
          clientManifest: this.context.resources.modernManifest
        }
      )
    }
  }

  renderTemplate(ssr, opts) {
    // Fix problem with HTMLPlugin's minify option (#3392)
    opts.html_attrs = opts.HTML_ATTRS
    opts.body_attrs = opts.BODY_ATTRS

    const fn = ssr ? this.context.resources.ssrTemplate : this.context.resources.spaTemplate

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
    const { req, res } = context
    const spa = context.spa || (res && res.spa)
    const ENV = this.context.options.env

    if (this.noSSR || spa) {
      const {
        HTML_ATTRS,
        BODY_ATTRS,
        HEAD,
        BODY_SCRIPTS,
        getPreloadFiles
      } = await this.renderer.spa.render(context)
      const APP =
        `<div id="${this.context.globals.id}">${this.context.resources.loadingHTML}</div>` + BODY_SCRIPTS

      const html = this.renderTemplate(false, {
        HTML_ATTRS,
        BODY_ATTRS,
        HEAD,
        APP,
        ENV
      })

      return { html, getPreloadFiles }
    }

    let APP
    // Call renderToString from the bundleRenderer and generate the HTML (will update the context as well)
    if (req && req.modernMode) {
      APP = await this.renderer.modern.renderToString(context)
    } else {
      APP = await this.renderer.ssr.renderToString(context)
    }

    if (!context.nuxt.serverRendered) {
      APP = `<div id="${this.context.globals.id}"></div>`
    }
    const m = context.meta.inject()
    let HEAD =
      m.title.text() +
      m.meta.text() +
      m.link.text() +
      m.style.text() +
      m.script.text() +
      m.noscript.text()
    if (this.context.options._routerBaseSpecified) {
      HEAD += `<base href="${this.context.options.router.base}">`
    }

    if (this.context.options.render.resourceHints) {
      HEAD += this.renderResourceHints(context)
    }

    await this.context.nuxt.callHook('render:routeContext', context.nuxt)

    const serializedSession = `window.${this.context.globals.context}=${devalue(context.nuxt)};`

    const cspScriptSrcHashSet = new Set()
    if (this.context.options.render.csp) {
      const { hashAlgorithm } = this.context.options.render.csp
      const hash = crypto.createHash(hashAlgorithm)
      hash.update(serializedSession)
      cspScriptSrcHashSet.add(`'${hashAlgorithm}-${hash.digest('base64')}'`)
    }

    APP += `<script>${serializedSession}</script>`
    APP += this.renderScripts(context)
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
        key: 'modernManifest',
        fileName: 'vue-ssr-modern-manifest.json',
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
