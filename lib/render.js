'use strict'

const debug = require('debug')('nuxt:render')
import co from 'co'
import { urlJoin, getContext } from './utils'
// force blue color
debug.color = 4

export function render (req, res) {
  if (!this.renderer && !this.dev) {
    console.error('> No build files found, please run `nuxt build` before launching `nuxt start`') // eslint-disable-line no-console
    process.exit(1)
  }
  /* istanbul ignore if */
  if (!this.renderer) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.render(req, res))
      }, 1000)
    })
  }
  const self = this
  const context = getContext(req, res)
  return co(function * () {
    res.statusCode = 200
    if (self.dev) {
      // Call webpack middleware only in development
      yield self.webpackDevMiddleware(req, res)
      yield self.webpackHotMiddleware(req, res)
    }
    // If base in req.url, remove it for the middleware and vue-router
    if (self.options.router.base !== '/' && req.url.indexOf(self.options.router.base) === 0) {
      // Compatibility with base url for dev server
      req.url = req.url.replace(self.options.router.base, '/')
    }
    // Serve static/ files
    yield self.serveStatic(req, res)
    // Serve .nuxt/dist/ files (only for production)
    if (!self.dev && self.options.nuxtStatic && req.url.indexOf(self.options.build.publicPath) === 0) {
      const url = req.url
      req.url = req.url.replace(self.options.build.publicPath, '/')
      yield self.serveStaticNuxt(req, res)
      /* istanbul ignore next */
      req.url = url
    }
  })
  .then(() => {
    /* istanbul ignore if */
    if (this.dev && req.url.indexOf(self.options.build.publicPath) === 0 && req.url.includes('.hot-update.json')) {
      res.statusCode = 404
      return res.end()
    }
    return this.renderRoute(req.url, context)
  })
  .then(({ html, error }) => {
    if (error) {
      res.statusCode = context.nuxt.error.statusCode || 500
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(html))
    res.end(html, 'utf8')
    return html
  })
  .catch((err) => {
    res.statusCode = 500
    res.end(this.errorTemplate({ err }), 'utf8')
    return err
  })
}

export function renderRoute (url, context = {}) {
  debug(`Rendering url ${url}`)
  // Add url and isSever to the context
  context.url = url
  context.isServer = true
  // Call rendertoSting from the bundleRenderer and generate the HTML (will update the context as well)
  const self = this
  return co(function * () {
    let app = yield self.renderToString(context)
    if (!context.nuxt.serverRendered) {
      app = '<div id="__nuxt"></div>'
    }
    const publicPath = self.options.build.publicPath
    const html = self.appTemplate({
      dev: self.dev, // Use to add the extracted CSS <link> in production
      baseUrl: self.options.router.base,
      APP: app,
      context: context,
      files: {
        css: urlJoin(publicPath, self.options.build.filenames.css),
        vendor: urlJoin(publicPath, self.options.build.filenames.vendor),
        app: urlJoin(publicPath, self.options.build.filenames.app)
      }
    })
    return {
      html,
      error: context.nuxt.error,
      redirected: context.redirected
    }
  })
}

// Function used to do dom checking via jsdom
let jsdom = null
export function renderAndGetWindow (url, opts = {}) {
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
  let virtualConsole = jsdom.createVirtualConsole().sendTo(console)
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
          return reject({
            message: 'Could not load the nuxt app',
            body: window.document.getElementsByTagName('body')[0].innerHTML
          })
        }
        // Used by nuxt.js to say when the components are loaded and the app ready
        window.onNuxtReady(() => {
          resolve(window)
        })
      }
    })
  })
}
