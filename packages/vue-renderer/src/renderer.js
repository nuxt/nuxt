import path from 'path'
import crypto from 'crypto'
import fs from 'fs-extra'
import consola from 'consola'
import devalue from '@nuxt/devalue'
import invert from 'lodash/invert'
import template from 'lodash/template'
import { isUrl, urlJoin } from '@nuxt/utils'
import { createBundleRenderer } from 'vue-server-renderer'

import SPAMetaRenderer from './spa-meta'

export default class VueRenderer {
  constructor(context) {
    this.context = context

    const { build: { publicPath }, router: { base } } = this.context.options
    this.publicPath = isUrl(publicPath) ? publicPath : urlJoin(base, publicPath)

    // Will be set by createRenderer
    this.renderer = {
      ssr: undefined,
      modern: undefined,
      spa: undefined
    }

    // Renderer runtime resources
    Object.assign(this.context.resources, {
      clientManifest: undefined,
      modernManifest: undefined,
      serverManifest: undefined,
      ssrTemplate: undefined,
      spaTemplate: undefined,
      errorTemplate: this.parseTemplate('Nuxt.js Internal Server Error')
    })

    // Default status
    this._state = 'created'
    this._error = null
  }

  get assetsMapping() {
    if (this._assetsMapping) {
      return this._assetsMapping
    }

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
      const scriptPattern = /<script[^>]*?src="([^"]*?)"[^>]*?>[^<]*?<\/script>/g

      return context.renderScripts().replace(scriptPattern, (scriptTag, jsFile) => {
        const legacyJsFile = jsFile.replace(this.publicPath, '')
        const modernJsFile = this.assetsMapping[legacyJsFile]
        const { build: { crossorigin } } = this.context.options
        const cors = `${crossorigin ? ` crossorigin="${crossorigin}"` : ''}`
        const moduleTag = modernJsFile
          ? scriptTag
            .replace('<script', `<script type="module"${cors}`)
            .replace(legacyJsFile, modernJsFile)
          : ''
        const noModuleTag = scriptTag.replace('<script', `<script nomodule${cors}`)

        return noModuleTag + moduleTag
      })
    }

    return context.renderScripts()
  }

  getModernFiles(legacyFiles = []) {
    const modernFiles = []

    for (const legacyJsFile of legacyFiles) {
      const modernFile = { ...legacyJsFile, modern: true }
      if (modernFile.asType === 'script') {
        const file = this.assetsMapping[legacyJsFile.file]
        modernFile.file = file
        modernFile.fileWithoutQuery = file.replace(/\?.*/, '')
      }
      modernFiles.push(modernFile)
    }

    return modernFiles
  }

  getSsrPreloadFiles(context) {
    const preloadFiles = context.getPreloadFiles()

    // In eligible server modern mode, preloadFiles are modern bundles from modern renderer
    return this.context.options.modern === 'client' ? this.getModernFiles(preloadFiles) : preloadFiles
  }

  renderSsrResourceHints(context) {
    if (this.context.options.modern === 'client') {
      const linkPattern = /<link[^>]*?href="([^"]*?)"[^>]*?as="script"[^>]*?>/g

      return context.renderResourceHints().replace(linkPattern, (linkTag, jsFile) => {
        const legacyJsFile = jsFile.replace(this.publicPath, '')
        const modernJsFile = this.assetsMapping[legacyJsFile]
        if (!modernJsFile) {
          return ''
        }
        const { crossorigin } = this.context.options.build
        const cors = `${crossorigin ? ` crossorigin="${crossorigin}"` : ''}`
        return linkTag.replace('rel="preload"', `rel="modulepreload"${cors}`).replace(legacyJsFile, modernJsFile)
      })
    }

    return context.renderResourceHints()
  }

  ready() {
    if (!this._readyPromise) {
      this._state = 'loading'
      this._readyPromise = this._ready()
        .then(() => {
          this._state = 'ready'
          return this
        })
        .catch((error) => {
          this._state = 'error'
          this._error = error
          throw error
        })
    }

    return this._readyPromise
  }

  async _ready() {
    // Resolve dist path
    this.distPath = path.resolve(this.context.options.buildDir, 'dist', 'server')

    // -- Development mode --
    if (this.context.options.dev) {
      this.context.nuxt.hook('build:resources', mfs => this.loadResources(mfs))
      return
    }

    // -- Production mode --

    // Try once to load SSR resources from fs
    await this.loadResources(fs)

    // Without using `nuxt start` (programmatic, tests and generate)
    if (!this.context.options._start) {
      this.context.nuxt.hook('build:resources', () => this.loadResources(fs))
      return
    }

    // Verify resources
    if (this.context.options.modern && !this.isModernReady) {
      throw new Error(
        `No modern build files found in ${this.distPath}.\nUse either \`nuxt build --modern\` or \`modern\` option to build modern files.`
      )
    } else if (!this.isReady) {
      throw new Error(
        `No build files found in ${this.distPath}.\nUse either \`nuxt build\` or \`builder.build()\` or start nuxt in development mode.`
      )
    }
  }

  async loadResources(_fs) {
    const updated = []

    const readResource = async (fileName, encoding) => {
      try {
        const fullPath = path.resolve(this.distPath, fileName)

        if (!await _fs.exists(fullPath)) {
          return
        }
        const contents = await _fs.readFile(fullPath, encoding)

        return contents
      } catch (err) {
        consola.error('Unable to load resource:', fileName, err)
      }
    }

    for (const resourceName in this.resourceMap) {
      const { fileName, transform, encoding } = this.resourceMap[resourceName]

      // Load resource
      let resource = await readResource(fileName, encoding)

      // Skip unavailable resources
      if (!resource) {
        continue
      }

      // Apply transforms
      if (typeof transform === 'function') {
        resource = await transform(resource, { readResource })
      }

      // Update resource
      this.context.resources[resourceName] = resource
      updated.push(resourceName)
    }

    // Load templates
    await this.loadTemplates()

    // Detect if any resource updated
    if (updated.length > 0) {
      // Invalidate assetsMapping cache
      delete this._assetsMapping

      // Create new renderer
      this.createRenderer()
    }

    return this.context.nuxt.callHook('render:resourcesLoaded', this.context.resources)
  }

  async loadTemplates() {
    // Reload error template
    const errorTemplatePath = path.resolve(this.context.options.buildDir, 'views/error.html')

    if (await fs.exists(errorTemplatePath)) {
      const errorTemplate = await fs.readFile(errorTemplatePath, 'utf8')
      this.context.resources.errorTemplate = this.parseTemplate(errorTemplate)
    }

    // Reload loading template
    const loadingHTMLPath = path.resolve(this.context.options.buildDir, 'loading.html')

    if (await fs.exists(loadingHTMLPath)) {
      this.context.resources.loadingHTML = await fs.readFile(loadingHTMLPath, 'utf8')
      this.context.resources.loadingHTML = this.context.resources.loadingHTML.replace(/\r|\n|[\t\s]{3,}/g, '')
    } else {
      this.context.resources.loadingHTML = ''
    }
  }

  // TODO: Remove in Nuxt 3
  get noSSR() { /* Backward compatibility */
    return this.context.options.render.ssr === false
  }

  get SSR() {
    return this.context.options.render.ssr === true
  }

  get isReady() {
    // SPA
    if (!this.context.resources.spaTemplate || !this.renderer.spa) {
      return false
    }

    // SSR
    if (this.SSR && (!this.context.resources.ssrTemplate || !this.renderer.ssr)) {
      return false
    }

    return true
  }

  get isModernReady() {
    return this.isReady && this.context.resources.modernManifest
  }

  // TODO: Remove in Nuxt 3
  get isResourcesAvailable() { /* Backward compatibility */
    return this.isReady
  }

  createRenderer() {
    // Resource clientManifest is always required
    if (!this.context.resources.clientManifest) {
      return
    }

    // Create SPA renderer
    if (this.context.resources.spaTemplate) {
      this.renderer.spa = new SPAMetaRenderer(this)
    }

    // Skip the rest if SSR resources are not available
    if (!this.context.resources.ssrTemplate || !this.context.resources.serverManifest) {
      return
    }

    const hasModules = fs.existsSync(path.resolve(this.context.options.rootDir, 'node_modules'))

    const rendererOptions = {
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
    opts.head_attrs = opts.HEAD_ATTRS
    opts.body_attrs = opts.BODY_ATTRS

    const templateFn = ssr ? this.context.resources.ssrTemplate : this.context.resources.spaTemplate

    return templateFn(opts)
  }

  async renderSPA(context) {
    const content = await this.renderer.spa.render(context)

    const APP = `<div id="${this.context.globals.id}">${this.context.resources.loadingHTML}</div>${content.BODY_SCRIPTS}`

    // Prepare template params
    const templateParams = {
      ...content,
      APP,
      ENV: this.context.options.env
    }

    // Call spa:templateParams hook
    this.context.nuxt.callHook('vue-renderer:spa:templateParams', templateParams)

    // Render with SPA template
    const html = this.renderTemplate(false, templateParams)

    return {
      html,
      getPreloadFiles: content.getPreloadFiles
    }
  }

  async renderSSR(context) {
    // Call renderToString from the bundleRenderer and generate the HTML (will update the context as well)
    const renderer = context.modern ? this.renderer.modern : this.renderer.ssr

    // Call ssr:context hook to extend context from modules
    await this.context.nuxt.callHook('vue-renderer:ssr:prepareContext', context)

    // Call Vue renderer renderToString
    let APP = await renderer.renderToString(context)

    // Call ssr:context hook
    await this.context.nuxt.callHook('vue-renderer:ssr:context', context)
    // TODO: Remove in next major release
    await this.context.nuxt.callHook('render:routeContext', context.nuxt)

    // Fallback to empty response
    if (!context.nuxt.serverRendered) {
      APP = `<div id="${this.context.globals.id}"></div>`
    }

    // Inject head meta
    const m = context.meta.inject()
    let HEAD =
      m.title.text() +
      m.meta.text() +
      m.link.text() +
      m.style.text() +
      m.script.text() +
      m.noscript.text()

    // Add <base href=""> meta if router base specified
    if (this.context.options._routerBaseSpecified) {
      HEAD += `<base href="${this.context.options.router.base}">`
    }

    // Inject resource hints
    if (this.context.options.render.resourceHints) {
      HEAD += this.renderSsrResourceHints(context)
    }

    // Inject styles
    HEAD += context.renderStyles()

    // Serialize state
    const serializedSession = `window.${this.context.globals.context}=${devalue(context.nuxt)};`
    APP += `<script>${serializedSession}</script>`

    // Calculate CSP hashes
    const { csp } = this.context.options.render
    const cspScriptSrcHashes = []
    if (csp) {
      // Only add the hash if 'unsafe-inline' rule isn't present to avoid conflicts (#5387)
      const containsUnsafeInlineScriptSrc = csp.policies && csp.policies['script-src'] && csp.policies['script-src'].includes(`'unsafe-inline'`)
      if (!containsUnsafeInlineScriptSrc) {
        const hash = crypto.createHash(csp.hashAlgorithm)
        hash.update(serializedSession)
        cspScriptSrcHashes.push(`'${csp.hashAlgorithm}-${hash.digest('base64')}'`)
      }

      // Call ssr:csp hook
      await this.context.nuxt.callHook('vue-renderer:ssr:csp', cspScriptSrcHashes)

      // Add csp meta tags
      if (csp.addMeta) {
        HEAD += `<meta http-equiv="Content-Security-Policy" content="script-src ${cspScriptSrcHashes.join()}">`
      }
    }

    // Prepend scripts
    APP += this.renderScripts(context)
    APP += m.script.text({ body: true })
    APP += m.noscript.text({ body: true })

    // Template params
    const templateParams = {
      HTML_ATTRS: 'data-n-head-ssr ' + m.htmlAttrs.text(),
      HEAD_ATTRS: m.headAttrs.text(),
      BODY_ATTRS: m.bodyAttrs.text(),
      HEAD,
      APP,
      ENV: this.context.options.env
    }

    // Call ssr:templateParams hook
    await this.context.nuxt.callHook('vue-renderer:ssr:templateParams', templateParams)

    // Render with SSR template
    const html = this.renderTemplate(true, templateParams)

    return {
      html,
      cspScriptSrcHashes,
      getPreloadFiles: this.getSsrPreloadFiles.bind(this, context),
      error: context.nuxt.error,
      redirected: context.redirected
    }
  }

  async renderRoute(url, context = {}, _retried) {
    /* istanbul ignore if */
    if (!this.isReady) {
      // Production
      if (!this.context.options.dev) {
        if (!_retried && ['loading', 'created'].includes(this._state)) {
          await this.ready()
          return this.renderRoute(url, context, true)
        }
        switch (this._state) {
          case 'created':
            throw new Error('Renderer ready() is not called! Please ensure `nuxt.ready()` is called and awaited.')
          case 'loading':
            throw new Error(`Renderer is loading.`)
          case 'error':
            throw this._error
          case 'ready':
            throw new Error(`Renderer is loaded but not all resources are unavailable! Please check ${this.distPath} existence.`)
          default:
            throw new Error('Renderer is in unknown state!')
        }
      }
      // Tell nuxt middleware to render UI
      return false
    }

    // Log rendered url
    consola.debug(`Rendering url ${url}`)

    // Add url to the context
    context.url = url

    const { req = {} } = context

    // context.spa
    if (context.spa === undefined) {
      // TODO: Remove reading from context.res in Nuxt3
      context.spa = !this.SSR || req.spa || (context.res && context.res.spa)
    }

    // context.modern
    if (context.modern === undefined) {
      context.modern = req.modernMode && this.context.options.modern === 'server'
    }

    // Call context hook
    await this.context.nuxt.callHook('vue-renderer:context', context)

    // Render SPA or SSR
    return context.spa
      ? this.renderSPA(context)
      : this.renderSSR(context)
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
        transform: async (src, { readResource }) => {
          const serverManifest = JSON.parse(src)

          const readResources = async (obj) => {
            const _obj = {}
            await Promise.all(Object.keys(obj).map(async (key) => {
              _obj[key] = await readResource(obj[key])
            }))
            return _obj
          }

          const [files, maps] = await Promise.all([
            readResources(serverManifest.files),
            readResources(serverManifest.maps)
          ])

          // Try to parse sourcemaps
          for (const map in maps) {
            if (maps[map] && maps[map].version) {
              continue
            }
            try {
              maps[map] = JSON.parse(maps[map])
            } catch (e) {
              maps[map] = { version: 3, sources: [], mappings: '' }
            }
          }

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

  close() {
    if (this.__closed) {
      return
    }
    this.__closed = true

    for (const key in this.renderer) {
      delete this.renderer[key]
    }
  }
}
