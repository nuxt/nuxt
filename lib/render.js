'use strict'

import ansiHTML from 'ansi-html'
import serialize from 'serialize-javascript'
import generateETag from 'etag'
import fresh from 'fresh'
import { getContext, setAnsiColors, encodeHtml } from './utils'

const debug = require('debug')('nuxt:render')
// force blue color
debug.color = 4
setAnsiColors(ansiHTML)

export async function render (req, res) {
  // Wait for nuxt.js to be ready
  await this.ready()
  // Check if project is built for production
  if (!this.renderer && !this.dev) {
    console.error('> No build files found, please run `nuxt build` before launching `nuxt start`') // eslint-disable-line no-console
    process.exit(1)
  }
  /* istanbul ignore if */
  if (!this.renderer || !this.appTemplate) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.render(req, res))
      }, 1000)
    })
  }
  // Get context
  const context = getContext(req, res)
  res.statusCode = 200
  try {
    if (this.dev) {
      // Call webpack middleware only in development
      await this.webpackDevMiddleware(req, res)
      await this.webpackHotMiddleware(req, res)
    }
    if (!this.dev && this.options.render.gzip) {
      await this.gzipMiddleware(req, res)
    }
    // If base in req.url, remove it for the middleware and vue-router
    if (this.options.router.base !== '/' && req.url.indexOf(this.options.router.base) === 0) {
      // Compatibility with base url for dev server
      req.url = req.url.replace(this.options.router.base, '/')
    }
    // Serve static/ files
    await this.serveStatic(req, res)
    // Serve .nuxt/dist/ files (only for production)
    if (!this.dev && req.url.indexOf(this.options.build.publicPath) === 0) {
      const url = req.url
      req.url = req.url.replace(this.options.build.publicPath, '/')
      await this.serveStaticNuxt(req, res)
      /* istanbul ignore next */
      req.url = url
    }
    if (this.dev && req.url.indexOf(this.options.build.publicPath) === 0 && req.url.includes('.hot-update.json')) {
      res.statusCode = 404
      return res.end()
    }
    const {html, error, redirected, resourceHints} = await this.renderRoute(req.url, context)
    if (redirected) {
      return html
    }
    if (error) {
      res.statusCode = context.nuxt.error.statusCode || 500
    }
    // ETag header
    if (!error && this.options.render.etag) {
      const etag = generateETag(html, this.options.render.etag)
      if (fresh(req.headers, {etag})) {
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
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(html))
    res.end(html, 'utf8')
    return html
  } catch (err) {
    if (context.redirected) {
      console.error(err) // eslint-disable-line no-console
      return err
    }
    const html = this.errorTemplate({
      /* istanbul ignore if */
      error: err,
      stack: ansiHTML(encodeHtml(err.stack))
    })
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(html))
    res.end(html, 'utf8')
    return err
  }
}

export async function renderRoute (url, context = {}) {
  // Wait for modules to be initialized
  await this.ready()
  // Log rendered url
  debug(`Rendering url ${url}`)
  // Add url and isSever to the context
  context.url = url
  context.isServer = true
  // Call renderToString from the bundleRenderer and generate the HTML (will update the context as well)
  let APP = await this.renderToString(context)
  if (!context.nuxt.serverRendered) {
    APP = '<div id="__nuxt"></div>'
  }
  const m = context.meta.inject()
  let HEAD = m.meta.text() + m.title.text() + m.link.text() + m.style.text() + m.script.text() + m.noscript.text()
  if (this._routerBaseSpecified) {
    HEAD += `<base href="${this.options.router.base}">`
  }
  const resourceHints = context.renderResourceHints()
  HEAD += resourceHints + context.renderStyles()
  APP += `<script type="text/javascript">window.__NUXT__=${serialize(context.nuxt, {isJSON: true})}</script>`
  APP += context.renderScripts()
  const html = this.appTemplate({
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

// Function used to do dom checking via jsdom
let jsdom = null
export async function renderAndGetWindow (url, opts = {}) {
  /* istanbul ignore if */
  if (!jsdom) {
    try {
      jsdom = require('jsdom')
    } catch (e) {
      console.error('Fail when calling nuxt.renderAndGetWindow(url)') // eslint-disable-line no-console
      console.error('jsdom module is not installed') // eslint-disable-line no-console
      console.error('Please install jsdom with: npm install --save-dev jsdom') // eslint-disable-line no-console
      process.exit(1)
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
  const {window} = await jsdom.JSDOM.fromURL(url, options)
  // If Nuxt could not be loaded (error from the server-side)
  const nuxtExists = window.document.body.innerHTML.includes('window.__NUXT__')
  if (!nuxtExists) {
    /* istanbul ignore next */
    let error = new Error('Could not load the nuxt app')
    /* istanbul ignore next */
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
