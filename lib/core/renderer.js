import path from 'path'
import crypto from 'crypto'

import serialize from 'serialize-javascript'
import serveStatic from 'serve-static'
import compression from 'compression'
import _ from 'lodash'
import fs from 'fs-extra'
import vueServerRenderer from 'vue-server-renderer'
import Debug from 'debug'
import connect from 'connect'
import launchMiddleware from 'launch-editor-middleware'

import { isUrl, waitFor, timeout } from '../common/utils'
import defaults from '../common/nuxt.config'

import MetaRenderer from './meta'
import errorMiddleware from './middleware/error'
import nuxtMiddleware from './middleware/nuxt'

const debug = Debug('nuxt:render')
debug.color = 4 // Force blue color

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
    let distPath = path.resolve(this.options.buildDir, 'dist')
    let updated = []

    resourceMap.forEach(({ key, fileName, transform }) => {
      let rawKey = '$$' + key
      const _path = path.join(distPath, fileName)

      let rawData, data
      if (!_fs.existsSync(_path)) {
        return // Resource not exists
      }
      rawData = _fs.readFileSync(_path, 'utf8')
      if (!rawData || rawData === this.resources[rawKey]) {
        return // No changes
      }
      this.resources[rawKey] = rawData
      data = transform(rawData)
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

    // Create bundle renderer for SSR
    this.bundleRenderer = vueServerRenderer.createBundleRenderer(
      this.resources.serverBundle,
      Object.assign(
        {
          clientManifest: this.resources.clientManifest,
          runInNewContext: false,
          basedir: this.options.rootDir
        },
        this.options.render.bundleRenderer
      )
    )
  }

  useMiddleware(m) {
    // Resolve
    const $m = m
    let src
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

    // Inject $src and $m to final handler
    if (src) handler.$src = src
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

    // Gzip middleware for production
    if (!this.options.dev && this.options.render.gzip) {
      this.useMiddleware(compression(this.options.render.gzip))
    }

    // Common URL checks
    this.useMiddleware((req, res, next) => {
      // Prevent access to SSR resources
      if (ssrResourceRegex.test(req.url)) {
        res.statusCode = 404
        return res.end()
      }
      next()
    })

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
      const distDir = path.resolve(this.options.buildDir, 'dist')
      this.useMiddleware({
        path: this.publicPath,
        handler: serveStatic(distDir, {
          index: false, // Don't serve index.html template
          maxAge: '1y' // 1 year in production
        })
      })
    }

    // Add User provided middleware
    this.options.serverMiddleware.forEach(m => {
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

  async renderRoute(url, context = {}) {
    /* istanbul ignore if */
    if (!this.isReady) {
      await waitFor(1000)
      return this.renderRoute(url, context)
    }

    // Log rendered url
    debug(`Rendering url ${url}`)

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

      const html = this.resources.spaTemplate({
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
      m.meta.text() +
      m.title.text() +
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

    const serializedSession = `window.__NUXT__=${serialize(context.nuxt, {
      isJSON: true
    })};`

    const cspScriptSrcHashes = []
    if (this.options.render.csp && this.options.render.csp.enabled) {
      let hash = crypto.createHash(this.options.render.csp.hashAlgorithm)
      hash.update(serializedSession)
      cspScriptSrcHashes.push(
        `'${this.options.render.csp.hashAlgorithm}-${hash.digest('base64')}'`
      )
    }

    APP += `<script>${serializedSession}</script>`
    APP += context.renderScripts()
    APP += m.script.text({ body: true })
    APP += m.noscript.text({ body: true })

    // TODO: vue-ssr need to handle https://github.com/vuejs/vue/issues/7897
    HEAD += context.renderStyles()

    let html = this.resources.ssrTemplate({
      HTML_ATTRS: 'data-n-head-ssr ' + m.htmlAttrs.text(),
      BODY_ATTRS: m.bodyAttrs.text(),
      HEAD,
      APP,
      ENV
    })

    return {
      html,
      cspScriptSrcHashes,
      getPreloadFiles: context.getPreloadFiles,
      error: context.nuxt.error,
      redirected: context.redirected
    }
  }

  async renderAndGetWindow(url, opts = {}) {
    /* istanbul ignore if */
    if (!jsdom) {
      try {
        jsdom = this.nuxt.requireModule('jsdom')
      } catch (e) /* istanbul ignore next */ {
        /* eslint-disable no-console */
        console.error('Fail when calling nuxt.renderAndGetWindow(url)')
        console.error('jsdom module is not installed')
        console.error('Please install jsdom with: npm install --save-dev jsdom')
        /* eslint-enable no-console */
        throw e
      }
    }
    let options = {
      resources: 'usable', // load subresources (https://github.com/tmpvar/jsdom#loading-subresources)
      runScripts: 'dangerously',
      beforeParse(window) {
        // Mock window.scrollTo
        window.scrollTo = () => {}
      }
    }
    const jsdomErrHandler = err => { throw err }
    if (opts.virtualConsole !== false) {
      options.virtualConsole = new jsdom.VirtualConsole().sendTo(console)
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
      let error = new Error('Could not load the nuxt app')
      error.body = window.document.body.innerHTML
      throw error
    }
    // Used by nuxt.js to say when the components are loaded and the app ready
    await timeout(new Promise(resolve => {
      window._onNuxtLoaded = () => resolve(window)
    }), 20000, 'Components loading in renderAndGetWindow was not completed in 20s')
    if (opts.virtualConsole !== false) {
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

const resourceMap = [
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

// Protector utility against request to SSR bundle files
const ssrResourceRegex = new RegExp(
  resourceMap.map(resource => resource.fileName).join('|'),
  'i'
)
