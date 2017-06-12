import _ from 'lodash'
import compression from 'compression'
import fs from 'fs-extra'
import pify from 'pify'
import serveStatic from 'serve-static'
import { resolve, join } from 'path'
import Tapable from 'tapable'
import * as Utils from './utils'
import Builder from './builder'
import Renderer from './renderer'
import Generator from './generator'
import ModuleContainer from './module-container'
import Server from './server'
import Defaults from './defaults'

export default class Nuxt extends Tapable {
  constructor (options = {}) {
    super()

    // Normalize options
    if (options.loading === true) {
      delete options.loading
    }
    if (options.router && typeof options.router.middleware === 'string') {
      options.router.middleware = [options.router.middleware]
    }
    if (options.router && typeof options.router.base === 'string') {
      this._routerBaseSpecified = true
    }
    if (typeof options.transition === 'string') {
      options.transition = { name: options.transition }
    }

    // Apply defaults
    this.options = _.defaultsDeep(options, Nuxt.Defaults)

    // Resolve dirs
    this.options.rootDir = (typeof options.rootDir === 'string' && options.rootDir ? options.rootDir : process.cwd())
    this.options.srcDir = (typeof options.srcDir === 'string' && options.srcDir ? resolve(options.rootDir, options.srcDir) : this.options.rootDir)
    this.options.buildDir = join(this.options.rootDir, options.buildDir)

    this.componentTasks()

    // Create instance of core components
    this.builder = new Nuxt.Builder(this)
    this.renderer = new Nuxt.Renderer(this)
    this.generator = new Nuxt.Generator(this)
    this.moduleContainer = new Nuxt.ModuleContainer(this)

    // Backward compatibility
    this.render = this.renderer.render.bind(this.renderer)
    this.renderRoute = this.renderer.renderRoute.bind(this.renderer)
    this.renderAndGetWindow = this.renderer.renderAndGetWindow.bind(this.renderer)
    this.build = this.ready.bind(this)
    this.generate = this.generator.generate.bind(this.generator)
    this.dir = options.rootDir
    this.srcDir = options.srcDir
    this.buildDir = options.buildDir
    this.Server = Nuxt.Server
    this.Utils = Nuxt.Utils

    // Wait for all core components be ready
    // eslint-disable-next-line no-console
    this._ready = this.ready().catch(console.error)
  }

  componentTasks () {
    // TODO: This task should move into their own components instead

    // Error template
    this.errorTemplate = _.template(fs.readFileSync(resolve(__dirname, 'views', 'error.html'), 'utf8'), {
      interpolate: /{{([\s\S]+?)}}/g
    })

    // If store defined, update store options to true
    if (fs.existsSync(join(this.options.srcDir, 'store'))) {
      this.options.store = true
    }

    // If app.html is defined, set the template path to the user template
    this.options.appTemplatePath = resolve(__dirname, 'views/app.template.html')
    if (fs.existsSync(join(this.options.srcDir, 'app.html'))) {
      this.options.appTemplatePath = join(this.options.srcDir, 'app.html')
    }

    // For serving static/ files to /
    this.serveStatic = pify(serveStatic(resolve(this.options.srcDir, 'static'), this.options.render.static))
    // For serving .nuxt/dist/ files (only when build.publicPath is not an URL)
    this.serveStaticNuxt = pify(serveStatic(resolve(this.options.buildDir, 'dist'), {
      maxAge: (this.options.dev ? 0 : '1y') // 1 year in production
    }))

    // gzip middleware for production
    if (!this.options.dev && this.options.render.gzip) {
      this.gzipMiddleware = pify(compression(this.options.render.gzip))
    }
  }

  async ready () {
    if (this._ready) {
      return this._ready
    }
    await this.moduleContainer.ready()
    await this.builder.ready()
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

// Add core components to Nuxt class
Nuxt.Defaults = Defaults
Nuxt.Utils = Utils
Nuxt.Renderer = Renderer
Nuxt.Builder = Builder
Nuxt.ModuleContainer = ModuleContainer
Nuxt.Server = Server
Nuxt.Generator = Generator
