import path from 'path'
import crypto from 'crypto'
import fs, { readFileSync, existsSync } from 'fs-extra'
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
      serverManifest: null,
      ssrTemplate: null,
      spaTemplate: null,
      errorTemplate: this.parseTemplate('Nuxt.js Internal Server Error')
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
      const scriptPattern = /<script[^>]*?src="([^"]*?)"[^>]*?>[^<]*?<\/script>/g
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

  getModernFiles(legacyFiles = []) {
    const modernFiles = []
    for (const legacyJsFile of legacyFiles) {
      const modernFile = { ...legacyJsFile }
      if (modernFile.asType === 'script') {
        const file = this.assetsMapping[legacyJsFile.file]
        modernFile.file = file
        modernFile.fileWithoutQuery = file.replace(/\?.*/, '')
      }
      modernFiles.push(modernFile)
    }
    return modernFiles
  }

  getPreloadFiles(context) {
    const preloadFiles = context.getPreloadFiles()
    const modernMode = this.context.options.modern
    // In eligible server modern mode, preloadFiles are modern bundles from modern renderer
    return modernMode === 'client' ? this.getModernFiles(preloadFiles) : preloadFiles
  }

  renderResourceHints(context) {
    if (this.context.options.modern === 'client') {
      const publicPath = this.context.options.build.publicPath
      const linkPattern = /<link[^>]*?href="([^"]*?)"[^>]*?as="script"[^>]*?>/g
      return context.renderResourceHints().replace(linkPattern, (linkTag, jsFile) => {
        const legacyJsFile = jsFile.replace(publicPath, '')
        const modernJsFile = this.assetsMapping[legacyJsFile]
        return linkTag.replace('rel="preload"', 'rel="modulepreload"').replace(legacyJsFile, modernJsFile)
      })
    }
    return context.renderResourceHints()
  }

  async ready() {
    // Production: Load SSR resources from fs
    if (!this.context.options.dev) {
      await this.loadResources()
    }
    this._ready = true
  }

  loadResources(_fs = fs) {
    const distPath = path.resolve(this.context.options.buildDir, 'dist', 'server')
    const updated = []
    const resourceMap = this.resourceMap

    const readResource = (fileName) => {
      try {
        const fullPath = path.resolve(distPath, fileName)
        if (!_fs.existsSync(fullPath)) {
          return
        }
        const contents = _fs.readFileSync(fullPath, 'utf-8')
        return contents
      } catch (err) {
        consola.error('Unable to load resource:', fileName, err)
      }
    }

    for (const resourceName in resourceMap) {
      const { fileName, transform } = resourceMap[resourceName]

      // Load resource
      let resource = readResource(fileName)

      // TODO: Enable baack when renderer initialzation was disabled for build only scripts
      // Fail when no build found and using programmatic usage
      // Currently this breaks normal nuxt build for first time
      if (!resource) {
        // if (!this.context.options.dev) {
        //   const invalidSSR = !this.noSSR && key === 'server'
        //   const invalidSPA = this.noSSR && key === 'spaTemplate'
        //   if (invalidSPA || invalidSSR) {
        //     consola.fatal(`Could not load Nuxt renderer, make sure to build for production: builder.build() with dev option set to false.`)
        //   }
        // }
        consola.debug('Resource not available:', resourceName)
        continue
      }

      // Apply transforms
      if (typeof transform === 'function') {
        resource = transform(resource, { readResource })
      }

      // Update resource
      this.context.resources[resourceName] = resource
      updated.push(resourceName)
    }

    // Reload error template
    const errorTemplatePath = path.resolve(this.context.options.buildDir, 'views/error.html')
    if (existsSync(errorTemplatePath)) {
      this.context.resources.errorTemplate = this.parseTemplate(
        readFileSync(errorTemplatePath, 'utf8')
      )
    }

    // Load loading template
    const loadingHTMLPath = path.resolve(this.context.options.buildDir, 'loading.html')
    if (existsSync(loadingHTMLPath)) {
      this.context.resources.loadingHTML = readFileSync(loadingHTMLPath, 'utf8')
      this.context.resources.loadingHTML = this.context.resources.loadingHTML
        .replace(/\r|\n|[\t\s]{3,}/g, '')
    } else {
      this.context.resources.loadingHTML = ''
    }

    if (updated.length > 0) {
      this.createRenderer()
    }

    // Call resourcesLoaded hook
    consola.debug('Resources loaded:', updated)
    return this.context.nuxt.callHook('render:resourcesLoaded', this.context.resources)
  }

  get noSSR() {
    return this.context.options.render.ssr === false
  }

  get isReady() {
    if (!this._ready) {
      return false
    }

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
    return Boolean(this.context.resources.ssrTemplate && this.context.resources.serverManifest)
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

    const hasModules = existsSync(path.resolve(this.context.options.rootDir, 'node_modules'))
    const rendererOptions = {
      runInNewContext: false,
      clientManifest: this.context.resources.clientManifest,
      // for globally installed nuxt command, search dependencies in global dir
      basedir: hasModules ? this.context.options.rootDir : __dirname,
      ...this.context.options.render.bundleRenderer
    }

    // Create bundle renderer for SSR
    this.renderer.ssr = createBundleRenderer(
      this.context.resources.serverManifest,
      rendererOptions
    )

    if (this.context.resources.modernManifest &&
      !['client', false].includes(this.context.options.modern)) {
      this.renderer.modern = createBundleRenderer(
        this.context.resources.serverManifest,
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
      consola.info('Waiting for server resources...')
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

      return { html, getPreloadFiles: this.getPreloadFiles.bind(this, { getPreloadFiles }) }
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
      getPreloadFiles: this.getPreloadFiles.bind(this, context),
      error: context.nuxt.error,
      redirected: context.redirected
    }
  }

  get resourceMap() {
    return {
      clientManifest: {
        fileName: 'client.manifest.json',
        transform: src => JSON.parse(src)
      },
      modernManifest: {
        fileName: 'modern.manifest.json',
        transform: src => JSON.parse(src)
      },
      serverManifest: {
        fileName: 'server.manifest.json',
        // BundleRenderer needs resolved contents
        transform(src, { readResource }) {
          const serverManifest = JSON.parse(src)

          const resolveAssets = (m) => {
            Object.keys(m).forEach((name) => {
              m[name] = readResource(m[name])
            })
            return m
          }

          const files = resolveAssets(serverManifest.files)
          const maps = resolveAssets(serverManifest.maps)

          return {
            ...serverManifest,
            files,
            maps
          }
        }
      },
      ssrTemplate: {
        fileName: 'index.ssr.html',
        transform: src => this.parseTemplate(src)
      },
      spaTemplate: {
        fileName: 'index.spa.html',
        transform: src => this.parseTemplate(src)
      }
    }
  }

  parseTemplate(templateStr) {
    return template(templateStr, {
      interpolate: /{{([\s\S]+?)}}/g
    })
  }
}
