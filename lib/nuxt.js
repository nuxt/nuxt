import _ from 'lodash'
import fs from 'fs-extra'
import { resolve, join } from 'path'
import Tapable from 'tappable'
import * as Utils from './utils'
import Builder from './builder'
import Renderer from './renderer'
import Generator from './generator'
import ModuleContainer from './module-container'
import Server from './server'
import Defaults from './defaults'

export default class Nuxt extends Tapable {
  constructor (_options = {}) {
    super()

    // Clone options to prevent unwanted side-effects
    const options = Object.assign({}, _options)

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

    // If store defined, update store options to true
    if (fs.existsSync(join(this.options.srcDir, 'store'))) {
      this.options.store = true
    }

    // If app.html is defined, set the template path to the user template
    this.options.appTemplatePath = resolve(__dirname, 'views/app.template.html')
    if (fs.existsSync(join(this.options.srcDir, 'app.html'))) {
      this.options.appTemplatePath = join(this.options.srcDir, 'app.html')
    }

    // Create instance of core components
    this.moduleContainer = new Nuxt.ModuleContainer(this)
    this.builder = new Nuxt.Builder(this)
    this.renderer = new Nuxt.Renderer(this)
    this.generator = new Nuxt.Generator(this)

    // Backward compatibility
    this.render = this.renderer.render.bind(this.renderer)
    this.renderRoute = this.renderer.renderRoute.bind(this.renderer)
    this.renderAndGetWindow = this.renderer.renderAndGetWindow.bind(this.renderer)
    this.build = this.builder.build.bind(this.builder)
    this.generate = this.generator.generate.bind(this.generator)
    this.dir = options.rootDir
    this.srcDir = options.srcDir
    this.buildDir = options.buildDir
    this.dev = options.dev
    this.Server = Nuxt.Server
    this.Utils = Nuxt.Utils

    this.errorHandler = this.errorHandler.bind(this)
    this._init = this.init().catch(this.errorHandler)
    this.initialized = false
  }

  async init () {
    if (this._init) {
      return this._init
    }

    // Wait for all components to be ready
    // Including modules
    await this.applyPluginsAsync('beforeInit')
    // Including Build
    await this.applyPluginsAsync('init')
    // Extra jobs
    this.applyPluginsAsync('afterInit').catch(this.errorHandler)

    this.initialized = true
    return this
  }

  errorHandler () {
    // Global error handler
    // Silent
    if (this.options.errorHandler === false) {
      return
    }
    // Custom eventHandler
    if (typeof this.options.errorHandler === 'function') {
      return this.options.errorHandler.apply(this, arguments)
    }
    // Default
    // eslint-disable-next-line no-console
    console.error.apply(this, arguments)
    process.exit(1)
  }

  async close (callback) {
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
