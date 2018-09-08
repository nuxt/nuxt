import path from 'path'
import crypto from 'crypto'

import serialize from 'serialize-javascript'
import serveStatic from 'serve-static'
import _ from 'lodash'
import fs from 'fs-extra'
import { createBundleRenderer } from 'vue-server-renderer'
import connect from 'connect'
import launchMiddleware from 'launch-editor-middleware'
import consola from 'consola'

import { isUrl, timeout, waitFor } from '../common/utils'
import defaults from '../common/nuxt.config'

import MetaRenderer from './meta'
import errorMiddleware from './middleware/error'
import nuxtMiddleware from './middleware/nuxt'

let jsdom = null

export default class Renderer {
  constructor(nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options

    // Will be set by createRenderer
    this.bundleRenderer = null
    this.metaRenderer = null

    // Will be available on dev
    this.webpackDevMiddleware = null
    this.webpackHotMiddleware = null

    // Create new connect instance
    this.app = connect()

    // Renderer runtime resources
    this.resources = {
      clientManifest: null,
      serverBundle: null,
      ssrTemplate: null,
      spaTemplate: null,
      errorTemplate: parseTemplate('Nuxt.js Internal Server Error')
    }
  }

  async ready() {
    await this.nuxt.callHook('render:before', this, this.options.render)
    // Setup nuxt middleware
    await this.setupMiddleware()

    // Production: Load SSR resources from fs
    if (!this.options.dev) {
      await this.loadResources()
    }

    // Call done hook
    await this.nuxt.callHook('render:done', this)
  }

  async loadResources(_fs = fs) {
    const distPath = path.resolve(this.options.buildDir, 'dist', 'server')
    const updated = []

    resourceMap.forEach(({ key, fileName, transform }) => {
      const rawKey = '$$' + key
      const _path = path.join(distPath, fileName)

      if (!_fs.existsSync(_path)) {
        return // Resource not exists
      }
      const rawData = _fs.readFileSync(_path, 'utf8')
      if (!rawData || rawData === this.resources[rawKey]) {
        return // No changes
      }
      this.resources[rawKey] = rawData
      const data = transform(rawData)
      /* istanbul ignore if */
      if (!data) {
        return // Invalid data ?
      }
      this.resources[key] = data
      updated.push(key)
    })

    // Reload error template
    const errorTemplatePath = path.resolve(this.options.buildDir, 'views/error.html')
    if (fs.existsSync(errorTemplatePath)) {
      this.resources.errorTemplate = parseTemplate(
        fs.readFileSync(errorTemplatePath, 'utf8')
      )
    }

    // Load loading template
    const loadingHTMLPath = path.resolve(this.options.buildDir, 'loading.html')
    if (fs.existsSync(loadingHTMLPath)) {
      this.resources.loadingHTML = fs.readFileSync(loadingHTMLPath, 'utf8')
      this.resources.loadingHTML = this.resources.loadingHTML
        .replace(/\r|\n|[\t\s]{3,}/g, '')
    } else {
      this.resources.loadingHTML = ''
    }

    // Call resourcesLoaded plugin
    await this.nuxt.callHook('render:resourcesLoaded', this.resources)

    if (updated.length > 0) {
      this.createRenderer()
    }
  }

  get noSSR() {
    return this.options.render.ssr === false
  }

  get isReady() {
    if (this.noSSR) {
      return Boolean(this.resources.spaTemplate)
    }

    return Boolean(this.bundleRenderer && this.resources.ssrTemplate)
  }

  get isResourcesAvailable() {
    // Required for both
    /* istanbul ignore if */
    if (!this.resources.clientManifest) {
      return false
    }

    // Required for SPA rendering
    if (this.noSSR) {
      return Boolean(this.resources.spaTemplate)
    }

    // Required for bundle renderer
    return Boolean(this.resources.ssrTemplate && this.resources.serverBundle)
  }

  createRenderer() {
    // Ensure resources are available
    if (!this.isResourcesAvailable) {
      return
    }

    // Create Meta Renderer
    this.metaRenderer = new MetaRenderer(this.nuxt, this)

    // Skip following steps if noSSR mode
    if (this.noSSR) {
      return
    }

    const hasModules = fs.existsSync(path.resolve(this.options.rootDir, 'node_modules'))
    // Create bundle renderer for SSR
    this.bundleRenderer = createBundleRenderer(
      this.resources.serverBundle,
      Object.assign(
        {
          clientManifest: this.resources.clientManifest,
          runInNewContext: false,
          // for globally installed nuxt command, search dependencies in global dir
          basedir: hasModules ? this.options.rootDir : __dirname
        },
        this.options.render.bundleRenderer
      )
    )
  }

  useMiddleware(m) {
    // Resolve
    const $m = m
    if (typeof m === 'string') {
      m = this.nuxt.requireModule(m)
    }
    if (typeof m.handler === 'string') {
      m.handler = this.nuxt.requireModule(m.handler)
    }

    const handler = m.handler || m
    const path = (
      (m.prefix !== false ? this.options.router.base : '') +
      (typeof m.path === 'string' ? m.path : '')
    ).replace(/\/\//g, '/')

    handler.$m = $m

    // Use middleware
    this.app.use(path, handler)
  }

  get publicPath() {
    return isUrl(this.options.build.publicPath)
      ? defaults.build.publicPath
      : this.options.build.publicPath
  }

  async setupMiddleware() {
    // Apply setupMiddleware from modules first
    await this.nuxt.callHook('render:setupMiddleware', this.app)

    // Compression middleware for production
    if (!this.options.dev) {
      const compressor = this.options.render.compressor
      if (typeof compressor === 'object') {
        // If only setting for `compression` are provided, require the module and insert
        // Prefer require instead of requireModule to keep dependency in nuxt-start
        const compression = require('compression')
        this.useMiddleware(compression(compressor))
      } else {
        // Else, require own compression middleware
        this.useMiddleware(compressor)
      }
    }

    // Add webpack middleware only for development
    if (this.options.dev) {
      this.useMiddleware(async (req, res, next) => {
        if (this.webpackDevMiddleware) {
          await this.webpackDevMiddleware(req, res)
        }
        if (this.webpackHotMiddleware) {
          await this.webpackHotMiddleware(req, res)
        }
        next()
      })
    }

    // open in editor for debug mode only
    if (this.options.debug && this.options.dev) {
      this.useMiddleware({
        path: '__open-in-editor',
        handler: launchMiddleware(this.options.editor)
      })
    }

    // For serving static/ files to /
    const staticMiddleware = serveStatic(
      path.resolve(this.options.srcDir, this.options.dir.static),
      this.options.render.static
    )
    staticMiddleware.prefix = this.options.render.static.prefix
    this.useMiddleware(staticMiddleware)

    // Serve .nuxt/dist/ files only for production
    // For dev they will be served with devMiddleware
    if (!this.options.dev) {
      const distDir = path.resolve(this.options.buildDir, 'dist', 'client')
      this.useMiddleware({
        path: this.publicPath,
        handler: serveStatic(
          distDir,
          this.options.render.dist
        )
      })
    }

    // Add User provided middleware
    this.options.serverMiddleware.forEach((m) => {
      this.useMiddleware(m)
    })

    // Finally use nuxtMiddleware
    this.useMiddleware(nuxtMiddleware.bind(this))

    // Error middleware for errors that occurred in middleware that declared above
    // Middleware should exactly take 4 arguments
    // https://github.com/senchalabs/connect#error-middleware

    // Apply errorMiddleware from modules first
    await this.nuxt.callHook('render:errorMiddleware', this.app)

    // Apply errorMiddleware from Nuxt
    this.useMiddleware(errorMiddleware.bind(this))
  }

  renderTemplate(ssr, opts) {
    // Fix problem with HTMLPlugin's minify option (#3392)
    opts.html_attrs = opts.HTML_ATTRS
    opts.body_attrs = opts.BODY_ATTRS

    const fn = ssr ? this.resources.ssrTemplate : this.resources.spaTemplate

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
    const ENV = this.options.env

    if (this.noSSR || spa) {
      const {
        HTML_ATTRS,
        BODY_ATTRS,
        HEAD,
        BODY_SCRIPTS,
        getPreloadFiles
      } = await this.metaRenderer.render(context)
      const APP =
        `<div id="__nuxt">${this.resources.loadingHTML}</div>` + BODY_SCRIPTS

      // Detect 404 errors
      if (
        url.includes(this.options.build.publicPath) ||
        url.includes('__webpack')
      ) {
        const err = {
          statusCode: 404,
          message: this.options.messages.error_404,
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
      APP = '<div id="__nuxt"></div>'
    }
    const m = context.meta.inject()
    let HEAD =
      m.title.text() +
      m.meta.text() +
      m.link.text() +
      m.style.text() +
      m.script.text() +
      m.noscript.text()
    if (this.options._routerBaseSpecified) {
      HEAD += `<base href="${this.options.router.base}">`
    }

    if (this.options.render.resourceHints) {
      HEAD += context.renderResourceHints()
    }

    await this.nuxt.callHook('render:routeContext', context.nuxt)

    const serializedSession = `window.__NUXT__=${serialize(context.nuxt, {
      isJSON: true
    })};`

    const cspScriptSrcHashSet = new Set()
    if (this.options.render.csp) {
      const { hashAlgorithm } = this.options.render.csp
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

  async renderAndGetWindow(url, opts = {}) {
    /* istanbul ignore if */
    if (!jsdom) {
      try {
        jsdom = require('jsdom')
      } catch (e) /* istanbul ignore next */ {
        consola.error(`
         Fail when calling nuxt.renderAndGetWindow(url)
         jsdom module is not installed
         Please install jsdom with: npm install --save-dev jsdom
        `)
        throw e
      }
    }
    const options = Object.assign({
      resources: 'usable', // load subresources (https://github.com/tmpvar/jsdom#loading-subresources)
      runScripts: 'dangerously',
      virtualConsole: true,
      beforeParse(window) {
        // Mock window.scrollTo
        window.scrollTo = () => {}
      }
    }, opts)
    const jsdomErrHandler = (err) => { throw err }
    if (options.virtualConsole) {
      if (options.virtualConsole === true) {
        options.virtualConsole = new jsdom.VirtualConsole().sendTo(consola)
      }
      // throw error when window creation failed
      options.virtualConsole.on('jsdomError', jsdomErrHandler)
    }
    url = url || 'http://localhost:3000'
    const { window } = await jsdom.JSDOM.fromURL(url, options)
    // If Nuxt could not be loaded (error from the server-side)
    const nuxtExists = window.document.body.innerHTML.includes(
      this.options.render.ssr ? 'window.__NUXT__' : '<div id="__nuxt">'
    )
    /* istanbul ignore if */
    if (!nuxtExists) {
      const error = new Error('Could not load the nuxt app')
      error.body = window.document.body.innerHTML
      throw error
    }
    // Used by nuxt.js to say when the components are loaded and the app ready
    await timeout(new Promise((resolve) => {
      window._onNuxtLoaded = () => resolve(window)
    }), 20000, 'Components loading in renderAndGetWindow was not completed in 20s')
    if (options.virtualConsole) {
      // after window initialized successfully
      options.virtualConsole.removeListener('jsdomError', jsdomErrHandler)
    }
    // Send back window object
    return window
  }
}

const parseTemplate = templateStr =>
  _.template(templateStr, {
    interpolate: /{{([\s\S]+?)}}/g
  })

export const resourceMap = [
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
    transform: parseTemplate
  },
  {
    key: 'spaTemplate',
    fileName: 'index.spa.html',
    transform: parseTemplate
  }
]
