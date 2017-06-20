import Tapable from 'tappable'
import chalk from 'chalk'
import ModuleContainer from './module'
import Renderer from './renderer'
import Options from './options'
import Debug from 'debug'

const debug = Debug('nuxt:')
debug.color = 5

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
    this.render = this.renderer.app
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

  listen (port = 3000, host = 'localhost') {
    return new Promise((resolve, reject) => {
      const server = this.renderer.app.listen({ port, host, exclusive: false }, err => {
        if (err) {
          return reject(err)
        }

        // Show Open URL
        let _host = host === '0.0.0.0' ? 'localhost' : host
        // eslint-disable-next-line no-console
        console.log('\n' + chalk.bold(chalk.bgBlue.black(' OPEN ') + chalk.blue(` http://${_host}:${port}\n`)))

        // Close server on nuxt close
        this.plugin('close', () => new Promise((_resolve, _reject) => {
          server.close(_err => {
            debug('server closed')
            if (_err) {
              return _reject(err)
            }
            _resolve()
          })
        }))

        resolve()
      })
    })
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
    await this.applyPluginsAsync('close')

    if (typeof callback === 'function') {
      await callback()
    }
  }
}
