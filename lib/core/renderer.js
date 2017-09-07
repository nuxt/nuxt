import ansiHTML from 'ansi-html'
import serialize from 'serialize-javascript'
import generateETag from 'etag'
import fresh from 'fresh'
import Tapable from 'tappable'
import pify from 'pify'
import serveStatic from 'serve-static'
import compression from 'compression'
import _ from 'lodash'
import { join, resolve } from 'path'
import fs from 'fs-extra'
import { createBundleRenderer } from 'vue-server-renderer'
import { getContext, setAnsiColors, isUrl } from 'utils'
import Debug from 'debug'
import Youch from '@nuxtjs/youch'
import { SourceMapConsumer } from 'source-map'
import connect from 'connect'
import { Options } from 'common'
import MetaRenderer from './meta'

const debug = Debug('nuxt:render')
debug.color = 4 // Force blue color

setAnsiColors(ansiHTML)

let jsdom = null

export default class Renderer extends Tapable {
  constructor (nuxt) {
    super()
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

  async _ready () {
    await this.nuxt.applyPluginsAsync('renderer', this)

    // Setup nuxt middleware
    await this.setupMiddleware()

    // Load SSR resources from fs
    if (!this.options.dev) {
      await this.loadResources()
    }

    // Call ready plugin
    await this.applyPluginsAsync('ready', this)
  }

  async loadResources (_fs = fs) {
    let distPath = resolve(this.options.buildDir, 'dist')
    let updated = []

    resourceMap.forEach(({ key, fileName, transform }) => {
      let rawKey = '$$' + key
      const path = join(distPath, fileName)

      let rawData, data
      if (!_fs.existsSync(path)) {
        return // Resource not exists
      }
      rawData = _fs.readFileSync(path, 'utf8')
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
    const errorTemplatePath = resolve(this.options.buildDir, 'views/error.html')
    if (fs.existsSync(errorTemplatePath)) {
      this.resources.errorTemplate = parseTemplate(fs.readFileSync(errorTemplatePath, 'utf8'))
    }

    // Load loading template
    const loadingHTMLPath = resolve(this.options.buildDir, 'loading.html')
    if (fs.existsSync(loadingHTMLPath)) {
      this.resources.loadingHTML = fs.readFileSync(loadingHTMLPath, 'utf8')
      this.resources.loadingHTML = this.resources.loadingHTML.replace(/[\r|\n]/g, '')
    } else {
      this.resources.loadingHTML = ''
    }

    // Call resourcesLoaded plugin
    await this.applyPluginsAsync('resourcesLoaded', this.resources)

    if (updated.length > 0) {
      // debug('Updated', updated.join(', '), isServer)
      this.createRenderer()
    }
  }

  get noSSR () {
    return this.options.render.ssr === false
  }

  get isReady () {
    if (this.noSSR) {
      return Boolean(this.resources.spaTemplate)
    }

    return Boolean(this.bundleRenderer && this.resources.ssrTemplate)
  }

  get isResourcesAvailable () {
    // Required for both
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

  createRenderer () {
    // Ensure resources are available
    if (!this.isResourcesAvailable) {
      return
    }

    // Create Meta Renderer
    this.metaRenderer = new MetaRenderer(this.nuxt, this)

    // Show Open URL
    this.nuxt.showOpen()

    // Skip following steps if noSSR mode
    if (this.noSSR) {
      return
    }

    // Create bundle renderer for SSR
    this.bundleRenderer = createBundleRenderer(this.resources.serverBundle, Object.assign({
      clientManifest: this.resources.clientManifest,
      runInNewContext: false,
      basedir: this.options.rootDir
    }, this.options.render.bundleRenderer))

    // Promisify renderToString
    this.bundleRenderer.renderToString = pify(this.bundleRenderer.renderToString)
  }

  useMiddleware (m) {
    // Resolve
    const $m = m
    let src
    if (typeof m === 'string') {
      src = this.nuxt.resolvePath(m)
      m = require(src)
    }
    if (typeof m.handler === 'string') {
      src = this.nuxt.resolvePath(m.handler)
      m.handler = require(src)
    }

    const handler = m.handler || m
    const path = (((m.prefix !== false) ? this.options.router.base : '') + (m.path ? m.path : '')).replace(/\/\//g, '/')

    // Inject $src and $m to final handler
    if (src) handler.$src = src
    handler.$m = $m

    // Use middleware
    this.app.use(path, handler)
  }

  get publicPath () {
    return isUrl(this.options.build.publicPath) ? Options.defaults.build.publicPath : this.options.build.publicPath
  }

  async setupMiddleware () {
    // Apply setupMiddleware from modules first
    await this.applyPluginsAsync('setupMiddleware', this.app)

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

    // For serving static/ files to /
    this.useMiddleware(serveStatic(resolve(this.options.srcDir, 'static'), this.options.render.static))

    // Serve .nuxt/dist/ files only for production
    // For dev they will be served with devMiddleware
    if (!this.options.dev) {
      const distDir = resolve(this.options.buildDir, 'dist')
      this.useMiddleware({
        path: this.publicPath,
        handler: serveStatic(distDir, {
          index: false, // Don't serve index.html template
          maxAge: (this.options.dev ? 0 : '1y') // 1 year in production
        })
      })
    }

    // Add User provided middleware
    this.options.serverMiddleware.forEach(m => {
      this.useMiddleware(m)
    })

    // Finally use nuxtMiddleware
    this.useMiddleware(this.nuxtMiddleware.bind(this))

    // Error middleware for errors that occurred in middleware that declared above
    // Middleware should exactly take 4 arguments
    // https://github.com/senchalabs/connect#error-middleware
    this.useMiddleware(this.errorMiddleware.bind(this))
  }

  async nuxtMiddleware (req, res, next) {
    // Get context
    const context = getContext(req, res)
    res.statusCode = 200
    try {
      const { html, error, redirected, resourceHints } = await this.renderRoute(req.url, context)
      if (redirected) {
        return html
      }
      if (error) {
        res.statusCode = context.nuxt.error.statusCode || 500
      }

      // Add ETag header
      if (!error && this.options.render.etag) {
        const etag = generateETag(html, this.options.render.etag)
        if (fresh(req.headers, { etag })) {
          res.statusCode = 304
          res.end()
          return
        }
        res.setHeader('ETag', etag)
      }

      // HTTP2 push headers
      if (!error && this.options.render.http2.push) {
        // Parse resourceHints to extract HTTP.2 prefetch/push headers
        // https://w3c.github.io/preload/#server-push-http-2
        const regex = /link rel="([^"]*)" href="([^"]*)" as="([^"]*)"/g
        const pushAssets = []
        let m
        while (m = regex.exec(resourceHints)) { // eslint-disable-line no-cond-assign
          const [_, rel, href, as] = m // eslint-disable-line no-unused-vars
          if (rel === 'preload') {
            pushAssets.push(`<${href}>; rel=${rel}; as=${as}`)
          }
        }
        // Pass with single Link header
        // https://blog.cloudflare.com/http-2-server-push-with-multiple-assets-per-link-header
        res.setHeader('Link', pushAssets.join(','))
      }

      // Send response
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Content-Length', Buffer.byteLength(html))
      res.end(html, 'utf8')
      return html
    } catch (err) {
      /* istanbul ignore if */
      if (context && context.redirected) {
        console.error(err) // eslint-disable-line no-console
        return err
      }

      next(err)
    }
  }

  errorMiddleware (err, req, res, next) {
    // ensure statusCode, message and name fields
    err.statusCode = err.statusCode || 500
    err.message = err.message || 'Nuxt Server Error'
    err.name = (!err.name || err.name === 'Error') ? 'NuxtServerError' : err.name

    const sendResponse = (content, type = 'text/html') => {
      // Set Headers
      res.statusCode = err.statusCode
      res.statusMessage = err.name
      res.setHeader('Content-Type', type + '; charset=utf-8')
      res.setHeader('Content-Length', Buffer.byteLength(content))

      // Send Response
      res.end(content, 'utf-8')
    }

    // Check if request accepts JSON
    const hasReqHeader = (header, includes) => req.headers[header] && req.headers[header].toLowerCase().includes(includes)
    const isJson = hasReqHeader('accept', 'application/json') || hasReqHeader('user-agent', 'curl/')

    // Use basic errors when debug mode is disabled
    if (!this.options.debug) {
      // Json format is compatible with Youch json responses
      const json = {
        status: err.statusCode,
        message: err.message,
        name: err.name
      }
      if (isJson) {
        sendResponse(JSON.stringify(json, undefined, 2), 'text/json')
        return
      }
      const html = this.resources.errorTemplate(json)
      sendResponse(html)
      return
    }

    // Show stack trace
    const youch = new Youch(err, req, this.readSource.bind(this))
    if (isJson) {
      youch.toJSON().then(json => { sendResponse(JSON.stringify(json, undefined, 2), 'text/json') })
    } else {
      youch.toHTML().then(html => { sendResponse(html) })
    }
  }

  async readSource (frame) {
    const serverBundle = this.resources.serverBundle

    // Remove webpack:/// & query string from the end
    const sanitizeName = name => name ? name.replace('webpack:///', '').split('?')[0] : ''

    // SourceMap Support for SSR Bundle
    if (serverBundle && serverBundle.maps[frame.fileName]) {
      // Initialize smc cache
      if (!serverBundle.$maps) {
        serverBundle.$maps = {}
      }

      // Read SourceMap object
      const smc = serverBundle.$maps[frame.fileName] || new SourceMapConsumer(serverBundle.maps[frame.fileName])
      serverBundle.$maps[frame.fileName] = smc

      // Try to find original position
      const { line, column, name, source } = smc.originalPositionFor({
        line: frame.getLineNumber() || 0,
        column: frame.getColumnNumber() || 0
      })
      if (line) {
        frame.lineNumber = line
      }
      if (column) {
        frame.columnNumber = column
      }
      if (name) {
        frame.functionName = name
      }
      if (source) {
        frame.fileName = sanitizeName(source)

        // Source detected, try to get original source code
        const contents = smc.sourceContentFor(source)
        if (contents) {
          frame.contents = contents
          return
        }
      }
    }

    // Return if fileName is still unknown
    if (!frame.fileName) {
      return
    }

    frame.fileName = sanitizeName(frame.fileName)

    // Try to read from SSR bundle files
    if (serverBundle && serverBundle.files[frame.fileName]) {
      frame.contents = serverBundle.files[frame.fileName]
      return
    }

    // Possible paths for file
    const searchPath = [
      this.options.rootDir,
      join(this.options.buildDir, 'dist'),
      this.options.srcDir,
      this.options.buildDir
    ]

    // Scan filesystem
    for (let pathDir of searchPath) {
      let fullPath = resolve(pathDir, frame.fileName)
      let source = await fs.readFile(fullPath, 'utf-8').catch(() => null)
      if (source) {
        frame.contents = source
        return
      }
    }
  }

  async renderRoute (url, context = {}) {
    /* istanbul ignore if */
    if (!this.isReady) {
      return new Promise(resolve => {
        setTimeout(() => resolve(this.renderRoute(url, context)), 1000)
      })
    }

    // Log rendered url
    debug(`Rendering url ${url}`)

    // Add url and isSever to the context
    context.url = url
    context.isServer = true

    // Basic response if SSR is disabled or spa data provided
    const spa = context.spa || (context.res && context.res.spa)
    if (this.noSSR || spa) {
      const { HTML_ATTRS, BODY_ATTRS, HEAD, resourceHints } = await this.metaRenderer.render(context)
      const APP = `<div id="__nuxt">${this.resources.loadingHTML}</div>`

      // Detect 404 errors
      if (url.includes(this.options.build.publicPath) || url.includes('__webpack')) {
        const err = { statusCode: 404, message: this.options.messages.error_404, name: 'ResourceNotFound' }
        throw err
      }

      const data = {
        HTML_ATTRS,
        BODY_ATTRS,
        HEAD,
        APP
      }

      const html = this.resources.spaTemplate(data)

      return { html, resourceHints }
    }

    // Call renderToString from the bundleRenderer and generate the HTML (will update the context as well)
    let APP = await this.bundleRenderer.renderToString(context)

    if (!context.nuxt.serverRendered) {
      APP = '<div id="__nuxt"></div>'
    }
    const m = context.meta.inject()
    let HEAD = m.meta.text() + m.title.text() + m.link.text() + m.style.text() + m.script.text() + m.noscript.text()
    if (this.options._routerBaseSpecified) {
      HEAD += `<base href="${this.options.router.base}">`
    }

    let resourceHints = ''

    if (this.options.render.resourceHints) {
      resourceHints = context.renderResourceHints()
      HEAD += resourceHints
    }
    APP += `<script type="text/javascript">window.__NUXT__=${serialize(context.nuxt, { isJSON: true })};</script>`
    APP += context.renderScripts()

    HEAD += context.renderStyles()

    let html = this.resources.ssrTemplate({
      HTML_ATTRS: 'data-n-head-ssr ' + m.htmlAttrs.text(),
      BODY_ATTRS: m.bodyAttrs.text(),
      HEAD,
      APP
    })

    return {
      html,
      resourceHints,
      error: context.nuxt.error,
      redirected: context.redirected
    }
  }

  async renderAndGetWindow (url, opts = {}) {
    /* istanbul ignore if */
    if (!jsdom) {
      try {
        jsdom = require('jsdom')
      } catch (e) /* istanbul ignore next */ {
        console.error('Fail when calling nuxt.renderAndGetWindow(url)') // eslint-disable-line no-console
        console.error('jsdom module is not installed') // eslint-disable-line no-console
        console.error('Please install jsdom with: npm install --save-dev jsdom') // eslint-disable-line no-console
        throw e
      }
    }
    let options = {
      resources: 'usable', // load subresources (https://github.com/tmpvar/jsdom#loading-subresources)
      runScripts: 'dangerously',
      beforeParse (window) {
        // Mock window.scrollTo
        window.scrollTo = () => {
        }
      }
    }
    if (opts.virtualConsole !== false) {
      options.virtualConsole = new jsdom.VirtualConsole().sendTo(console)
    }
    url = url || 'http://localhost:3000'
    const { window } = await jsdom.JSDOM.fromURL(url, options)
    // If Nuxt could not be loaded (error from the server-side)
    const nuxtExists = window.document.body.innerHTML.includes('window.__NUXT__')
    /* istanbul ignore if */
    if (!nuxtExists) {
      let error = new Error('Could not load the nuxt app')
      error.body = window.document.body.innerHTML
      throw error
    }
    // Used by nuxt.js to say when the components are loaded and the app ready
    await new Promise((resolve) => {
      window._onNuxtLoaded = () => resolve(window)
    })
    // Send back window object
    return window
  }
}

const parseTemplate = templateStr => _.template(templateStr, {
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
const ssrResourceRegex = new RegExp(resourceMap.map(resource => resource.fileName).join('|'), 'i')
