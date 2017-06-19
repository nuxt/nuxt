import Tapable from 'tappable'
import ModuleContainer from './module'
import Renderer from './renderer'
import Options from './options'

export default class Nuxt extends Tapable {
  constructor (_options = {}) {
    super()

    this.options = Options(_options)

    this.initialized = false
    this.errorHandler = this.errorHandler.bind(this)

    // Create instance of core components
    this.moduleContainer = new ModuleContainer(this)
    this.renderer = new Renderer(this)

    // Backward compatibility
    this.render = (...args) => this.renderer.app(...args)
    this.renderRoute = this.renderer.renderRoute.bind(this.renderer)
    this.renderAndGetWindow = this.renderer.renderAndGetWindow.bind(this.renderer)

    this._ready = this.ready()
  }

  async ready () {
    if (this._ready) {
      return this._ready
    }

    // Wait for all components to be ready
    await this.applyPluginsAsync('beforeInit') // 1- Modules
    await this.applyPluginsAsync('init') // 2- Builder
    await this.applyPluginsAsync('afterInit') // 3- Renderer

    this.initialized = true
    return this
  }

  errorHandler /* istanbul ignore next */ () {
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
    // Call for close
    await this.applyPluginsAsync('close')

    if (typeof callback === 'function') {
      await callback()
    }
  }
}
