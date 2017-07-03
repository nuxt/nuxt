import Tapable from 'tappable'
import chalk from 'chalk'
import ModuleContainer from './module'
import Renderer from './renderer'
import Options from './options'
import Debug from 'debug'
import enableDestroy from 'server-destroy'
import { join, resolve } from 'path'

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
        /* istanbul ignore if */
        if (err) {
          return reject(err)
        }

        // Show Open URL
        let _host = host === '0.0.0.0' ? 'localhost' : host
        // eslint-disable-next-line no-console
        console.log('\n' + chalk.bold(chalk.bgBlue.black(' OPEN ') + chalk.blue(` http://${_host}:${port}\n`)))

        // Close server on nuxt close
        this.plugin('close', () => new Promise((resolve, reject) => {
          // Destroy server by forcing every connection to be closed
          server.destroy(err => {
            debug('server closed')
            /* istanbul ignore if */
            if (err) {
              return reject(err)
            }
            resolve()
          })
        }))

        resolve()
      })
      // Add server.destroy(cb) method
      enableDestroy(server)
    })
  }

  errorHandler /* istanbul ignore next */() {
    // Apply plugins
    // eslint-disable-next-line no-console
    this.applyPluginsAsync('error', ...arguments).catch(console.error)

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
    console.error(...arguments)
  }

  resolvePath (path) {
    // Try to resolve using NPM resolve path first
    // Fixes problems with scopped modules
    try {
      let resolvedPath = require.resolve(path)
      return resolvedPath
    } catch (e) {
      // Just continue
    }

    // Shorthand to resolve from project srcDir
    if (path.indexOf('@') === 0 || path.indexOf('~') === 0) {
      if (path.indexOf('~') === 0) {
        // eslint-disable-next-line no-console
        console.warn('[nuxt] Aliases using `~` are deprecated, please use `@/` instead.',
          path, '->', path.replace('~/', '@/').replace('~', '@/'))
      }
      return join(this.options.srcDir, path.substr(1))
    }
    return resolve(this.options.srcDir, path)
  }

  async close (callback) {
    await this.applyPluginsAsync('close')

    /* istanbul ignore if */
    if (typeof callback === 'function') {
      await callback()
    }
  }
}
