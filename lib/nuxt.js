'use strict'

import _ from 'lodash'
import co from 'co'
import compression from 'compression'
import fs from 'fs-extra'
import pify from 'pify'
import Server from './server'
import * as build from './build'
import * as render from './render'
import generate from './generate'
import serveStatic from 'serve-static'
import { resolve, join } from 'path'
import * as utils from './utils'

class Nuxt {

  constructor (options = {}) {
    var defaults = {
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
        mode: 'history',
        base: '/',
        middleware: [],
        linkActiveClass: 'nuxt-link-active',
        extendRoutes: null,
        scrollBehavior: null
      },
      performance: {
        gzip: true,
        prefetch: true
      },
      build: {}
    }
    // Sanitization
    if (options.loading === true) delete options.loading
    if (options.router && typeof options.router.middleware === 'string') options.router.middleware = [ options.router.middleware ]
    if (typeof options.transition === 'string') options.transition = { name: options.transition }
    this.options = _.defaultsDeep(options, defaults)
    // Env variables
    this.dev = this.options.dev
    this.dir = (typeof options.rootDir === 'string' && options.rootDir ? options.rootDir : process.cwd())
    this.srcDir = (typeof options.srcDir === 'string' && options.srcDir ? resolve(this.dir, options.srcDir) : this.dir)
    // If store defined, update store options to true
    if (fs.existsSync(join(this.srcDir, 'store'))) {
      this.options.store = true
    }
    // If middleware defined, update middleware option to true
    this.options.middleware = false
    if (fs.existsSync(join(this.srcDir, 'middleware'))) {
      this.options.middleware = true
    }
    // renderer used by Vue.js (via createBundleRenderer)
    this.renderer = null
    // For serving static/ files to /
    this.serveStatic = pify(serveStatic(resolve(this.srcDir, 'static')))
    // For serving .nuxt/dist/ files (only when build.publicPath is not an URL)
    this.serveStaticNuxt = pify(serveStatic(resolve(this.dir, '.nuxt', 'dist'), {
      maxAge: (this.dev ? 0 : '1y') // 1 year in production
    }))
    // gzip for production
    if (!this.dev) {
      this.gzipMiddleware = pify(compression({
        threshold: 0
      }))
    }
    // Add this.Server Class
    this.Server = Server
    // Add this.build
    build.options.call(this) // Add build options
    this.build = () => co(build.build.bind(this))
    // Error template
    this.errorTemplate = _.template(fs.readFileSync(resolve(__dirname, 'views', 'error.html'), 'utf8'), {
      interpolate: /{{([\s\S]+?)}}/g
    })
    // Add this.render and this.renderRoute
    this.render = render.render.bind(this)
    this.renderRoute = render.renderRoute.bind(this)
    this.renderAndGetWindow = render.renderAndGetWindow.bind(this)
    // Add this.generate
    this.generate = generate.bind(this)
    // Add this.utils (tests purpose)
    this.utils = utils
    return this
  }

  close (callback) {
    let promises = []
    /* istanbul ignore if */
    if (this.webpackDevMiddleware) {
      const p = new Promise((resolve, reject) => {
        this.webpackDevMiddleware.close(() => resolve())
      })
      promises.push(p)
    }
    /* istanbul ignore if */
    if (this.webpackServerWatcher) {
      const p = new Promise((resolve, reject) => {
        this.webpackServerWatcher.close(() => resolve())
      })
      promises.push(p)
    }
    /* istanbul ignore if */
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

export default Nuxt
