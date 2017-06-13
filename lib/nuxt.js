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
    this.Server = Nuxt.Server
    this.Utils = Nuxt.Utils

    // eslint-disable-next-line no-console
    this._init = this.init().catch(console.error)
    this.initialized = false
  }

  async init () {
    if (this._init) {
      return this._init
    }
    // Wait for all components to be ready
    await this.applyPluginsAsync('beforeInit')
    await this.applyPluginsAsync('init')
    this.applyPluginsAsync('afterInit')
    this.initialized = true
    return this
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
