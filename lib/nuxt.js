'use strict'

const debug = require('debug')('nuxt:render')
const _ = require('lodash')
const co = require('co')
const fs = require('fs')
const pify = require('pify')
const ansiHTML = require('ansi-html')
const serialize = require('serialize-javascript')
const build = require('./build')
const serveStatic = require('serve-static')
const { resolve, join } = require('path')
const { encodeHtml, getContext, setAnsiColors } = require('./utils')
setAnsiColors(ansiHTML)

class Nuxt {

  constructor (options = {}, cb) {
    var defaults = {
      filenames: {
        css: 'style.css',
        vendor: 'vendor.bundle.js',
        app: 'nuxt.bundle.js'
      },
      routes: [],
      vendor: [],
      css: [],
      store: false,
      cache: false,
      loading: {
        loadingColor: 'black',
        errorColor: 'red',
        duration: 5000
      }
    }
    if (options.loading === true) delete options.loading
    this.options = _.defaultsDeep(options, defaults)
    // Env variables
    this.isProd = process.env.NODE_ENV === 'production'
    this.isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
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
    this.getContext = (this.options.getContext === 'function' ? this.options.getContext : getContext)
    // For serving .nuxt/dist/ files
    this.serveStatic = pify(serveStatic(resolve(this.dir, '.nuxt', 'dist')))
    // Add this.build
    this.build = build.bind(this)
    // Launch build and set this.renderer
    return co(this.build)
    // .then((nuxt) => {
    //   if (typeof cb === 'function') cb(null, nuxt)
    // })
    // .catch((err) => {
    //   if (typeof cb === 'function') cb(err)
    // })
  }

  render (req, res) {
    if (!this.renderer) {
      setTimeout(() => {
        this.render(req, res)
      }, 1000)
      return
    }
    const self = this
    const context = this.getContext(req, res)
    co(function * () {
      if (self.isDev) {
        // Call webpack middlewares only in development
        yield self.webpackDevMiddleware(req, res)
        yield self.webpackHotMiddleware(req, res)
        return
      }
      if (req.url.includes('/_nuxt/')) {
        const url = req.url
        req.url = req.url.replace('/_nuxt/', '/')
        yield self.serveStatic(req, res)
        req.url = url
      }
    })
    .then(() => {
      if (this.isDev && req.url.includes('/_nuxt/') && req.url.includes('.hot-update.json')) {
        res.statusCode = 404
        return res.end()
      }
      return this.renderRoute(req.url, context)
    })
    .then((html) => {
      if (context.nuxt.error && context.nuxt.error.statusCode) {
        res.statusCode = context.nuxt.error.statusCode
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
      const html = yield self.renderToString(context)
      const app = self.appTemplate({
        isProd: self.isProd, // Use to add the extracted CSS <link> in production
        APP: html,
        context: context,
        files: {
          css: join('/_nuxt/', self.options.filenames.css),
          vendor: join('/_nuxt/', self.options.filenames.vendor),
          app: join('/_nuxt/', self.options.filenames.app)
        }
      })
      return app
    })
  }

  stop (callback) {
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
    return co(function * () {
      yield promises
    })
    .then(function () {
      if (typeof callback === 'function') callback()
    })
  }

}

module.exports = Nuxt
