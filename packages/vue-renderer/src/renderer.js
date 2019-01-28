import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import consola from 'consola'
import devalue from '@nuxt/devalue'
import invert from 'lodash/invert'
import template from 'lodash/template'
import { waitFor } from '@nuxt/utils'
import { createBundleRenderer } from 'vue-server-renderer'

import SPAMetaRenderer from './spa-meta'

export default class VueRenderer {
  constructor(context) {
    this.context = context

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
      const { publicPath, crossorigin } = this.context.options.build
      const scriptPattern = /<script[^>]*?src="([^"]*?)"[^>]*?>[^<]*?<\/script>/g
      return context.renderScripts().replace(scriptPattern, (scriptTag, jsFile) => {
        const legacyJsFile = jsFile.replace(publicPath, '')
        const modernJsFile = this.assetsMapping[legacyJsFile]
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

  getPreloadFiles(context) {
    const preloadFiles = context.getPreloadFiles()
    const modernMode = this.context.options.modern
    // In eligible server modern mode, preloadFiles are modern bundles from modern renderer
    return modernMode === 'client' ? this.getModernFiles(preloadFiles) : preloadFiles
  }

  renderResourceHints(context) {
    if (this.context.options.modern === 'client') {
      const { publicPath, crossorigin } = this.context.options.build
      const linkPattern = /<link[^>]*?href="([^"]*?)"[^>]*?as="script"[^>]*?>/g
      return context.renderResourceHints().replace(linkPattern, (linkTag, jsFile) => {
        const legacyJsFile = jsFile.replace(publicPath, '')
        const modernJsFile = this.assetsMapping[legacyJsFile]
        if (!modernJsFile) {
          return ''
        }
        const cors = `${crossorigin ? ` crossorigin="${crossorigin}"` : ''}`
        return linkTag.replace('rel="preload"', `rel="modulepreload"${cors}`).replace(legacyJsFile, modernJsFile)
      })
    }
    return context.renderResourceHints()
  }

  async ready() {
    // -- Development mode --

    if (this.context.options.dev) {
      this.context.nuxt.hook('build:resources', mfs => this.loadResources(mfs, true))
      return
    }

    // -- Production mode --

    // Try once to load SSR resources from fs
    await this.loadResources(fs)

    // Without using`nuxt start` (Programatic, Tests and Generate)
    if (!this.context.options._start) {
      this.context.nuxt.hook('build:resources', () => this.loadResources(fs))
    }

    // Verify resources
    if (this.context.options._start) {
      if (!this.isReady) {
        throw new Error(
          'No build files found. Use either `nuxt build` or `builder.build()` or start nuxt in development mode.'
        )
      } else if (this.context.options.modern && !this.context.resources.modernManifest) {
        throw new Error(
          'No modern build files found. Use either `nuxt build --modern` or `modern` option to build modern files.'
        )
      }
    }
  }

  loadResources(_fs, isMFS = false) {
    const distPath = path.resolve(this.context.options.buildDir, 'dist', 'server')
    const updated = []
    const { resourceMap } = this

    const readResource = (fileName, encoding) => {
      try {
        const fullPath = path.resolve(distPath, fileName)
        if (!_fs.existsSync(fullPath)) {
          return
        }
        const contents = _fs.readFileSync(fullPath, encoding)
        if (isMFS) {
          // Cleanup MFS as soon as possible to save memory
          _fs.unlinkSync(fullPath)
          delete this._assetsMapping
        }
        return contents
      } catch (err) {
        consola.error('Unable to load resource:', fileName, err)
      }
    }

    for (const resourceName in resourceMap) {
      const { fileName, transform, encoding } = resourceMap[resourceName]

      // Load resource
      let resource = readResource(fileName, encoding)

      // Skip unavailable resources
      if (!resource) {
        consola.debug('Resource not available:', resourceName)
        continue
      }

      // Apply transforms
      if (typeof transform === 'function') {
        resource = transform(resource, {
          readResource,
          oldValue: this.context.resources[resourceName]
        })
      }

      // Update resource
      this.context.resources[resourceName] = resource
      updated.push(resourceName)
    }

    // Reload error template
    const errorTemplatePath = path.resolve(this.context.options.buildDir, 'views/error.html')
    if (fs.existsSync(errorTemplatePath)) {
      this.context.resources.errorTemplate = this.parseTemplate(
        fs.readFileSync(errorTemplatePath, 'utf8')
      )
    }

    // Reload loading template
    const loadingHTMLPath = path.resolve(this.context.options.buildDir, 'loading.html')
    if (fs.existsSync(loadingHTMLPath)) {
      this.context.resources.loadingHTML = fs.readFileSync(loadingHTMLPath, 'utf8')
      this.context.resources.loadingHTML = this.context.resources.loadingHTML
        .replace(/\r|\n|[\t\s]{3,}/g, '')
    } else {
      this.context.resources.loadingHTML = ''
    }

    // Call createRenderer if any resource changed
    if (updated.length > 0) {
      this.createRenderer()
    }

    // Call resourcesLoaded hook
    consola.debug('Resources loaded:', updated.join(','))
    return this.context.nuxt.callHook('render:resourcesLoaded', this.context.resources)
  }

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

    const fn = ssr ? this.context.resources.ssrTemplate : this.context.resources.spaTemplate

    return fn(opts)
  }

  async renderRoute(url, context = {}, retries = 5) {
    /* istanbul ignore if */
    if (!this.isReady) {
      if (this.context.options.dev && retries > 0) {
        consola.info('Waiting for server resources...')
        await waitFor(1000)
        return this.renderRoute(url, context, retries - 1)
      } else {
        throw new Error('Server resources are not available!')
      }
    }

    // Log rendered url
    consola.debug(`Rendering url ${url}`)

    // Add url and isSever to the context
    context.url = url

    // Basic response if SSR is disabled or SPA data provided
    const { req, res } = context
    const spa = context.spa || (res && res.spa)
    const ENV = this.context.options.env

    if (!this.SSR || spa) {
      const {
        HTML_ATTRS,
        HEAD_ATTRS,
        BODY_ATTRS,
        HEAD,
        BODY_SCRIPTS,
        getPreloadFiles
      } = await this.renderer.spa.render(context)
      const APP =
        `<div id="${this.context.globals.id}">${this.context.resources.loadingHTML}</div>` + BODY_SCRIPTS

      const html = this.renderTemplate(false, {
        HTML_ATTRS,
        HEAD_ATTRS,
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

    const cspScriptSrcHashes = []
    if (this.context.options.render.csp) {
      const { hashAlgorithm } = this.context.options.render.csp
      const hash = crypto.createHash(hashAlgorithm)
      hash.update(serializedSession)
      cspScriptSrcHashes.push(`'${hashAlgorithm}-${hash.digest('base64')}'`)
    }

    APP += `<script>${serializedSession}</script>`
    APP += this.renderScripts(context)
    APP += m.script.text({ body: true })
    APP += m.noscript.text({ body: true })

    HEAD += context.renderStyles()

    const html = this.renderTemplate(true, {
      HTML_ATTRS: 'data-n-head-ssr ' + m.htmlAttrs.text(),
      HEAD_ATTRS: m.headAttrs.text(),
      BODY_ATTRS: m.bodyAttrs.text(),
      HEAD,
      APP,
      ENV
    })

    return {
      html,
      cspScriptSrcHashes,
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
        transform: (src, { readResource, oldValue = { files: {}, maps: {} } }) => {
          const serverManifest = JSON.parse(src)

          const resolveAssets = (obj, oldObj) => {
            Object.keys(obj).forEach((name) => {
              obj[name] = readResource(obj[name])
              // Try to reuse deleted MFS files if no new version exists
              if (!obj[name]) {
                obj[name] = oldObj[name]
              }
            })
            return obj
          }

          const files = resolveAssets(serverManifest.files, oldValue.files)
          const maps = resolveAssets(serverManifest.maps, oldValue.maps)

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
