'use strict'

import ansiHTML from 'ansi-html'
import serialize from 'serialize-javascript'
import { getContext, setAnsiColors, encodeHtml } from './utils'
const debug = require('debug')('nuxt:render')
// force blue color
debug.color = 4
setAnsiColors(ansiHTML)

export async function render (req, res) {
  if (!this.renderer && !this.dev) {
    console.error('> No build files found, please run `nuxt build` before launching `nuxt start`') // eslint-disable-line no-console
    process.exit(1)
  }
  /* istanbul ignore if */
  if (!this.renderer || !this.appTemplate) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // debug('Waiting for renderer to be ready')
        resolve(this.render(req, res))
      }, 1000)
    })
  }
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
    const { html, error, redirected } = await this.renderRoute(req.url, context)
    if (redirected) {
      return html
    }
    if (error) {
      res.statusCode = context.nuxt.error.statusCode || 500
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
  HEAD += context.renderResourceHints() + context.renderStyles()
  APP += `<script type="text/javascript">window.__NUXT__=${serialize(context.nuxt, { isJSON: true })}</script>`
  APP += context.renderScripts()
  const html = this.appTemplate({
    HTML_ATTRS: 'data-n-head-ssr ' + m.htmlAttrs.text(),
    BODY_ATTRS: m.bodyAttrs.text(),
    HEAD,
    APP
  })
  return {
    html,
    error: context.nuxt.error,
    redirected: context.redirected
  }
}

// Function used to do dom checking via jsdom
let jsdom = null
export function renderAndGetWindow (url, opts = {}) {
  /* istanbul ignore if */
  if (!jsdom) {
    try {
      // https://github.com/tmpvar/jsdom/blob/master/lib/old-api.md
      jsdom = require('jsdom/lib/old-api')
    } catch (e) {
      console.error('Fail when calling nuxt.renderAndGetWindow(url)') // eslint-disable-line no-console
      console.error('jsdom module is not installed') // eslint-disable-line no-console
      console.error('Please install jsdom with: npm install --save-dev jsdom') // eslint-disable-line no-console
      process.exit(1)
    }
  }
  let virtualConsole = jsdom.createVirtualConsole().sendTo(console)
  // let virtualConsole = new jsdom.VirtualConsole().sendTo(console)
  if (opts.virtualConsole === false) {
    virtualConsole = undefined
  }
  url = url || 'http://localhost:3000'
  return new Promise((resolve, reject) => {
    jsdom.env({
      url: url,
      features: {
        FetchExternalResources: ['script', 'link'],
        ProcessExternalResources: ['script']
      },
      virtualConsole,
      done (err, window) {
        if (err) return reject(err)
        // Mock window.scrollTo
        window.scrollTo = function () {}
        // If Nuxt could not be loaded (error from the server-side)
        if (!window.__NUXT__) {
          let error = new Error('Could not load the nuxt app')
          error.body = window.document.getElementsByTagName('body')[0].innerHTML
          return reject(error)
        }
        // Used by nuxt.js to say when the components are loaded and the app ready
        window.onNuxtReady(() => {
          resolve(window)
        })
      }
    })
  })
}
