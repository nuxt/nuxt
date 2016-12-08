'use strict'

const _ = require('lodash')
const co = require('co')
const fs = require('fs-extra')
const pify = require('pify')
const ansiHTML = require('ansi-html')
const serialize = require('serialize-javascript')
const build = require('./build')
const render = require('./render')
const generate = require('./generate')
const serveStatic = require('serve-static')
const { resolve, join } = require('path')
const { encodeHtml, setAnsiColors } = require('./utils')
setAnsiColors(ansiHTML)

class Nuxt {

  constructor (options = {}, cb) {
    var defaults = {
      // special options
      _renderer: true,
      _build: true,
      // general options
      dev: true,
      env: {},
      head: {},
      plugins: [],
      css: [],
      cache: false,
      loading: {
        color: 'black',
        failedColor: 'red',
        height: '2px',
        duration: 5000
      },
      transition: {
        name: 'page',
        mode: 'out-in'
      },
      router: {
        base: '/',
        linkActiveClass: 'router-link-active',
        routes: []
      },
      build: {}
    }
    if (options.loading === true) delete options.loading
    if (typeof options.transition === 'string') options.transition = { name: options.transition }
    this.options = _.defaultsDeep(options, defaults)
    // Env variables
    this.dev = this.options.dev
    this.dir = (typeof options.rootDir === 'string' && options.rootDir ? options.rootDir : process.cwd())
    this.srcDir = (typeof options.srcDir === 'string' && options.srcDir ? options.srcDir : this.dir)
    // If store defined, update store options to true
    if (fs.existsSync(join(this.srcDir, 'store', 'index.js'))) {
      this.options.store = true
    }
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
    this.serveStatic = pify(serveStatic(resolve(this.srcDir, 'static')))
    // For serving .nuxt/dist/ files
    this._nuxtRegexp = /^\/_nuxt\//
    this.serveStaticNuxt = pify(serveStatic(resolve(this.dir, '.nuxt', 'dist')))
    // Add this.build
    build.options.call(this) // Add build options
    this.build = () => co(build.build.bind(this))
    // Add this.render and this.renderRoute
    this.render = render.render.bind(this)
    this.renderRoute = render.renderRoute.bind(this)
    this.renderAndGetWindow = render.renderAndGetWindow.bind(this)
    // Add this.generate
    this.generate = generate.bind(this)
    return this
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
