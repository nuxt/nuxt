import Tapable from 'tappable'
import chalk from 'chalk'
import ModuleContainer from './module'
import Renderer from './renderer'
import Options from './options'
import Core from './index'

const defaultHost = process.env.HOST || process.env.npm_package_config_nuxt_host || 'localhost'
const defaultPort = process.env.PORT || process.env.npm_package_config_nuxt_port || '3000'

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

  get builder () {
    if (this._builder) {
      return this._builder
    }
    this._builder = new Core.Builder(this)
    return this._builder
  }

  get generator () {
    if (this._generator) {
      return this._generator
    }
    this._generator = new Core.Generator(this)
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

  // Both Renderer & Server depend on this method
  serverReady ({ host = defaultHost, port = defaultPort } = {}) {
    let _host = host === '0.0.0.0' ? 'localhost' : host

    // eslint-disable-next-line no-console
    console.log('\n' + chalk.bold(chalk.bgBlue.black(' OPEN ') + chalk.blue(` http://${_host}:${port}\n`)))

    return this.applyPluginsAsync('serverReady').catch(this.errorHandler)
  }

  async close (callback) {
    // Call for close
    await this.applyPluginsAsync('close')

    // Remove all references
    delete this._generator
    delete this._builder

    this.initialized = false

    if (typeof callback === 'function') {
      await callback()
    }
  }
}
