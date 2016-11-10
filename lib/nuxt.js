'use strict'

const debug = require('debug')('nuxt:render')
const _ = require('lodash')
const co = require('co')
const fs = require('fs')
const pify = require('pify')
const ansiHTML = require('ansi-html')
const serialize = require('serialize-javascript')
const build = require('./build')
const generate = require('./generate')
const serveStatic = require('serve-static')
const { resolve } = require('path')
const { urlJoin } = require('./utils')
const { encodeHtml, getContext, setAnsiColors } = require('./utils')
setAnsiColors(ansiHTML)

class Nuxt {

  constructor (options = {}, cb) {
    var defaults = {
      // special options
      _renderer: true,
      _build: true,
      // general options
      dev: true,
      plugins: [],
      css: [],
      store: false,
      cache: false,
      loading: {
        color: 'black',
        failedColor: 'red',
        height: '2px',
        duration: 5000
      },
      router: {
        base: '/',
        linkActiveClass: 'router-link-active',
        routes: []
      },
      build: {
        filenames: {
          css: 'style.css'
        }
      }
    }
    if (options.loading === true) delete options.loading
    this.options = _.defaultsDeep(options, defaults)
    // Env variables
    this.dev = this.options.dev
    this.dir = (typeof options.rootDir === 'string' && options.rootDir ? options.rootDir : process.cwd())
    // Template
    this.appTemplate = _.template(fs.readFileSync(resolve(__dirname, 'views', 'app.html'), 'utf8'), {
      imports: { serialize }
    })
    this.errorTemplate = _.template(fs.readFileSync(resolve(__dirname, 'views', 'error.html'), 'utf8'), {
      imports: { ansiHTML, encodeHtml }
    })
    // renderer used by Vue.js (via createBundleRenderer)
    this.renderer = null
    // For serving static/ files to /
    this.serveStatic = pify(serveStatic(resolve(this.dir, 'static')))
    // For serving .nuxt/dist/ files
    this._nuxtRegexp = /^\/_nuxt\//
    this.serveStaticNuxt = pify(serveStatic(resolve(this.dir, '.nuxt', 'dist')))
    // Add this.build
    this.build = build.bind(this)
    // Add this.generate
    this.generate = generate.bind(this)
    // Launch build and set this.renderer
    return co(this.build)
    .then(() => {
      if (typeof cb === 'function') cb(null, this)
      return this
    })
    .catch((err) => {
      if (typeof cb === 'function') cb(err)
      return Promise.reject(err)
    })
  }

  render (req, res) {
    if (!this.renderer) {
      setTimeout(() => {
        this.render(req, res)
      }, 1000)
      return
    }
    const self = this
    const context = getContext(req, res)
    co(function * () {
      if (self.dev) {
        // Call webpack middlewares only in development
        yield self.webpackDevMiddleware(req, res)
        yield self.webpackHotMiddleware(req, res)
      }
      // If base in req.url, remove it for the middlewares and vue-router
      if (self.options.router.base !== '/' && req.url.indexOf(self.options.router.base) === 0) {
        // Compatibility with base url for dev server
        req.url = req.url.replace(self.options.router.base, '/')
      }
      // Serve static/ files
      yield self.serveStatic(req, res)
      // Serve .nuxt/dist/ files (only for production)
      if (!self.dev && self._nuxtRegexp.test(req.url)) {
        const url = req.url
        req.url = req.url.replace(self._nuxtRegexp, '/')
        yield self.serveStaticNuxt(req, res)
        req.url = url
      }
    })
    .then(() => {
      if (this.dev && this._nuxtRegexp.test(req.url) && req.url.includes('.hot-update.json')) {
        res.statusCode = 404
        return res.end()
      }
      return this.renderRoute(req.url, context)
    })
    .then(({ html, error }) => {
      if (error) {
        res.statusCode = context.nuxt.error.statusCode || 500
      }
      res.end(html, 'utf8')
    })
    .catch((err) => {
      res.statusCode = 500
      res.end(this.errorTemplate({ err }), 'utf8')
    })
  }

  renderRoute (url, context = {}) {
    debug(`Rendering url ${url}`)
    // Add url and isSever to the context
    context.url = url
    context.isServer = true
    // Call rendertoSting from the bundleRenderer and generate the HTML (will update the context as well)
    const self = this
    return co(function * () {
      const app = yield self.renderToString(context)
      if (context.nuxt && context.nuxt.error instanceof Error) {
        context.nuxt.error = { statusCode: 500, message: context.nuxt.error.message }
      }
      const html = self.appTemplate({
        dev: self.dev, // Use to add the extracted CSS <link> in production
        baseUrl: (self.options.router.base !== '/' ? self.options.router.base : null),
        APP: app,
        context: context,
        files: {
          css: urlJoin(self.options.router.base, '/_nuxt/', self.options.build.filenames.css),
          vendor: urlJoin(self.options.router.base, '/_nuxt/', self.options.build.filenames.vendor),
          app: urlJoin(self.options.router.base, '/_nuxt/', self.options.build.filenames.app)
        }
      })
      return { html, error: context.nuxt.error }
    })
  }

  close (callback) {
    let promises = []
    if (this.webpackDevMiddleware) {
      const p = new Promise((resolve, reject) => {
        this.webpackDevMiddleware.close(() => resolve())
      })
      promises.push(p)
    }
    if (this.webpackServerWatcher) {
      const p = new Promise((resolve, reject) => {
        this.webpackServerWatcher.close(() => resolve())
      })
      promises.push(p)
    }
    if (this.pagesFilesWatcher) {
      this.pagesFilesWatcher.close()
    }
    return co(function * () {
      yield promises
    })
    .then(function () {
      if (typeof callback === 'function') callback()
    })
  }

}

module.exports = Nuxt
