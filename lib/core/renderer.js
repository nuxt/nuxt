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
import { encodeHtml, getContext, setAnsiColors } from 'utils'
import Debug from 'debug'

const debug = Debug('nuxt:render')
debug.color = 4 // Force blue color

setAnsiColors(ansiHTML)

let jsdom = null

const parseTemplate = templateStr => _.template(templateStr, {
  interpolate: /{{([\s\S]+?)}}/g
})

export default class Renderer extends Tapable {
  constructor (nuxt) {
    super()
    this.nuxt = nuxt
    this.options = nuxt.options

    // Will be set by createRenderer
    this.bundleRenderer = null

    // Will be available on dev
    this.webpackDevMiddleware = null
    this.webpackHotMiddleware = null

    // Renderer runtime resources
    this.resources = {
      clientManifest: null,
      serverBundle: null,
      appTemplate: null,
      errorTemplate: parseTemplate('<pre>{{ stack }}</pre>') // Will be loaded on ready
    }

    // Initialize
    /* istanbul ignore if */
    if (nuxt.initialized) {
      // If nuxt already initialized
      this._ready = this.ready().catch(this.nuxt.errorHandler)
    } else {
      // Wait for hook
      this.nuxt.plugin('afterInit', () => {
        this._ready = this.ready()
        return this._ready
      })
    }
  }

  async ready () {
    /* istanbul ignore if */
    if (this._ready) {
      return this._ready
    }

    // For serving static/ files to /
    this.serveStatic = pify(serveStatic(resolve(this.options.srcDir, 'static'), this.options.render.static))

    // For serving .nuxt/dist/ files
    this.serveStaticNuxt = pify(serveStatic(resolve(this.options.buildDir, 'dist'), {
      maxAge: (this.options.dev ? 0 : '1y') // 1 year in production
    }))

    // GZIP middleware for production
    if (!this.options.dev && this.options.render.gzip) {
      this.gzipMiddleware = pify(compression(this.options.render.gzip))
    }

    const errorTemplatePath = resolve(this.options.buildDir, 'views/error.html')
    if (fs.existsSync(errorTemplatePath)) {
      this.resources.errorTemplate = parseTemplate(fs.readFileSync(errorTemplatePath, 'utf8'))
    }

    // Load resources from fs
    if (!this.options.dev) {
      await this.loadResources()
    }

    return this
  }

  async loadResources (_fs = fs, isServer) {
    let distPath = resolve(this.options.buildDir, 'dist')

    const resourceMap = {
      clientManifest: {
        path: join(distPath, 'vue-ssr-client-manifest.json'),
        transform: JSON.parse
      },
      serverBundle: {
        path: join(distPath, 'server-bundle.json'),
        transform: JSON.parse
      },
      appTemplate: {
        path: join(distPath, 'index.html'),
        transform: parseTemplate
      }
    }

    let updated = []

    Object.keys(resourceMap).forEach(resourceKey => {
      let { path, transform } = resourceMap[resourceKey]
      let rawKey = '$$' + resourceKey
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
      this.resources[resourceKey] = data
      updated.push(resourceKey)
    })

    if (updated.length > 0) {
      // debug('Updated', updated.join(', '), isServer)
      this.createRenderer()
    }
  }

  createRenderer () {
    // If resources are not yet provided
    if (!this.resources.serverBundle || !this.resources.clientManifest) {
      return
    }

    // Create bundle renderer for SSR
    this.bundleRenderer = createBundleRenderer(this.resources.serverBundle, Object.assign({
      clientManifest: this.resources.clientManifest,
      runInNewContext: false,
      basedir: this.options.rootDir
    }, this.options.render.ssr, this.options.build.ssr))

    if(this.options.build.ssr) {
      console.warn('[nuxt] `build.ssr` is deprecated and will be removed in 1.0 release, please use `renderer.ssr` instead!')
    }

    // Promisify renderToString
    this.bundleRenderer.renderToString = pify(this.bundleRenderer.renderToString)
  }

  async render (req, res) {
    // Get context
    const context = getContext(req, res)
    res.statusCode = 200

    try {
      // Gzip middleware for production
      if (this.gzipMiddleware) {
        await this.gzipMiddleware(req, res)
      }

      // If base in req.url, remove it for the middleware and vue-router
      if (this.options.router.base !== '/' && req.url.indexOf(this.options.router.base) === 0) {
        // Compatibility with base url for dev server
        req.url = req.url.replace(this.options.router.base, '/')
      }

      // Call webpack middleware only in development
      if (this.webpackDevMiddleware) {
        await this.webpackDevMiddleware(req, res)
      }

      if (this.webpackHotMiddleware) {
        await this.webpackHotMiddleware(req, res)
      }

      // Serve static/ files
      await this.serveStatic(req, res)

      // Serve .nuxt/dist/ files (only for production)
      const isValidExtension = (req.url.slice(-3) === '.js') || (req.url.slice(-4) === '.css') || (req.url.slice(-4) === '.map')
      if (!this.options.dev && isValidExtension) {
        const url = req.url
        if (req.url.indexOf(this.options.build.publicPath) === 0) {
          req.url = req.url.replace(this.options.build.publicPath, '/')
        }
        await this.serveStaticNuxt(req, res)
        /* istanbul ignore next */
        req.url = url
      }

      if (this.options.dev && req.url.indexOf(this.options.build.publicPath) === 0 && req.url.includes('.hot-update.json')) {
        res.statusCode = 404
        return res.end()
      }

      const { html, error, redirected, resourceHints } = await this.renderRoute(req.url, context)

      if (redirected) {
        return html
      }

      if (error) {
        res.statusCode = context.nuxt.error.statusCode || 500
      }

      // ETag header
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
      if (context.redirected) {
        console.error(err) // eslint-disable-line no-console
        return err
      }
      // Render error template
      const html = this.resources.errorTemplate({
        /* istanbul ignore if */
        error: err,
        stack: ansiHTML(encodeHtml(err.stack))
      })
      // Send response
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Content-Length', Buffer.byteLength(html))
      res.end(html, 'utf8')
      return err
    }
  }

  async renderRoute (url, context = {}) {
    /* istanbul ignore if */
    if (!this.bundleRenderer || !this.resources.appTemplate) {
      return new Promise(resolve => {
        setTimeout(() => resolve(this.renderRoute(url, context)), 1000)
      })
    }

    // Log rendered url
    debug(`Rendering url ${url}`)

    // Add url and isSever to the context
    context.url = url
    context.isServer = true

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
    const resourceHints = context.renderResourceHints()
    HEAD += resourceHints + context.renderStyles()
    APP += `<script type="text/javascript">window.__NUXT__=${serialize(context.nuxt, { isJSON: true })}</script>`
    APP += context.renderScripts()

    const html = this.resources.appTemplate({
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
