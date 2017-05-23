'use strict'

import _ from 'lodash'
import compression from 'compression'
import fs from 'fs-extra'
import pify from 'pify'
import Server from './server'
import Module from './module'
import * as build from './build'
import * as render from './render'
import generate from './generate'
import serveStatic from 'serve-static'
import { resolve, join } from 'path'
import * as utils from './utils'

class Nuxt {
  constructor (options = {}) {
    const defaults = {
      dev: true,
      env: {},
      head: {
        meta: [],
        link: [],
        style: [],
        script: []
      },
      plugins: [],
      css: [],
      modules: [],
      layouts: {},
      serverMiddleware: [],
      ErrorPage: null,
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
        linkExactActiveClass: 'nuxt-link-exact-active',
        extendRoutes: null,
        scrollBehavior: null
      },
      render: {
        static: {},
        gzip: {
          threshold: 0
        },
        etag: {
          weak: true // Faster for responses > 5KB
        }
      },
      watchers: {
        webpack: {},
        chokidar: {}
      },
      build: {}
    }
    // Sanitization
    if (options.loading === true) delete options.loading
    if (options.router && typeof options.router.middleware === 'string') options.router.middleware = [ options.router.middleware ]
    if (options.router && typeof options.router.base === 'string') {
      this._routerBaseSpecified = true
    }
    if (typeof options.transition === 'string') options.transition = { name: options.transition }
    this.options = _.defaultsDeep(options, defaults)
    // Env variables
    this.dev = this.options.dev
    // Explicit srcDir, rootDir and buildDir
    this.dir = (typeof options.rootDir === 'string' && options.rootDir ? options.rootDir : process.cwd())
    this.srcDir = (typeof options.srcDir === 'string' && options.srcDir ? resolve(this.dir, options.srcDir) : this.dir)
    this.buildDir = resolve(this.dir, '.nuxt')
    options.rootDir = this.dir
    options.srcDir = this.srcDir
    options.buildDir = this.buildDir
    // If store defined, update store options to true
    if (fs.existsSync(join(this.srcDir, 'store'))) {
      this.options.store = true
    }
    // If app.html is defined, set the template path to the user template
    this.options.appTemplatePath = resolve(__dirname, 'views/app.template.html')
    if (fs.existsSync(join(this.srcDir, 'app.html'))) {
      this.options.appTemplatePath = join(this.srcDir, 'app.html')
    }
    // renderer used by Vue.js (via createBundleRenderer)
    this.renderer = null
    // For serving static/ files to /
    this.serveStatic = pify(serveStatic(resolve(this.srcDir, 'static'), this.options.render.static))
    // For serving .nuxt/dist/ files (only when build.publicPath is not an URL)
    this.serveStaticNuxt = pify(serveStatic(resolve(this.buildDir, 'dist'), {
      maxAge: (this.dev ? 0 : '1y') // 1 year in production
    }))
    // gzip middleware for production
    if (!this.dev && this.options.render.gzip) {
      this.gzipMiddleware = pify(compression(this.options.render.gzip))
    }
    // Add this.Server Class
    this.Server = Server
    // Add this.build
    build.options.call(this) // Add build options
    this.build = build.build.bind(this)
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
    // Add module integration
    this.module = new Module(this)
    // Install all modules in sequence and then return `this` instance
    return utils.sequence(options.modules, this.module.addModule.bind(this.module))
    .then(() => this)
    .catch(/* istanbul ignore next */ (err) => {
      console.error('[nuxt] error while initializing modules') // eslint-disable-line no-console
      console.error(err) // eslint-disable-line no-console
      process.exit(1)
    })
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
    if (this.filesWatcher) {
      this.filesWatcher.close()
    }
    /* istanbul ignore if */
    if (this.customFilesWatcher) {
      this.customFilesWatcher.close()
    }
    return Promise.all(promises).then(() => {
      if (typeof callback === 'function') callback()
    })
  }
}

export default Nuxt
