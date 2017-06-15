import Tapable from 'tappable'
import Builder from './builder'
import * as Utils from './utils'
import Renderer from './renderer'
import ModuleContainer from './module-container'
import Server from './server'
import defaults from './defaults'

export default class Nuxt extends Tapable {
  constructor (_options = {}) {
    super()

    this.options = defaults(_options)

    this.initialized = false
    this.errorHandler = this.errorHandler.bind(this)

    // Create instance of core components
    this.moduleContainer = new Nuxt.ModuleContainer(this)
    this.renderer = new Nuxt.Renderer(this)

    // Backward compatibility
    this.render = this.renderer.render.bind(this.renderer)
    this.renderRoute = this.renderer.renderRoute.bind(this.renderer)
    this.renderAndGetWindow = this.renderer.renderAndGetWindow.bind(this.renderer)

    // Builder is lazy loaded, so register plugin here
    this.plugin('init', async () => {
      // Call to build on dev
      if (this.options.dev) {
        this.builder.build().catch(this.errorHandler)
      }
      // If explicitly runBuild required
      if (this.options.runBuild) {
        await this.builder.build()
      }
    })

    this._ready = this.ready().catch(this.errorHandler)
  }

  async ready () {
    if (this._ready) {
      return this._ready
    }

    // Wait for all components to be ready
    await this.applyPluginsAsync('beforeInit') // 1- Modules
    await this.applyPluginsAsync('init')       // 2- Builder
    await this.applyPluginsAsync('afterInit')  // 3- Renderer

    this.initialized = true
    return this
  }

  get builder () {
    if (this._builder) {
      return this._builder
    }
    // const Builder = require('./builder').default
    this._builder = new Builder(this)
    return this._builder
  }

  get generator () {
    if (this._generator) {
      return this._generator
    }
    const Generator = require('./generator').default
    this._generator = new Generator(this)
    return this._generator
  }

  generate () {
    return this.generator.generate.apply(this.generator, arguments)
  }

  errorHandler () {
    // Silent
    if (this.options.errorHandler === false) {
      return
    }
    // Custom errorHandler
    if (typeof this.options.errorHandler === 'function') {
      return this.options.errorHandler.apply(this, arguments)
    }
    // Default handler
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

    promises.push(this.applyPluginsAsync('close'))

    return Promise.all(promises).then(() => {
      if (typeof callback === 'function') callback()
    })
  }
}

// Add core components to Nuxt class
Nuxt.Utils = Utils
Nuxt.Renderer = Renderer
Nuxt.ModuleContainer = ModuleContainer
Nuxt.Server = Server
