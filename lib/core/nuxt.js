import Tapable from 'tappable'
import chalk from 'chalk'
import { Options } from 'common'
import ModuleContainer from './module'
import Renderer from './renderer'
import Debug from 'debug'
import enableDestroy from 'server-destroy'
import Module from 'module'
import { join, resolve } from 'path'

const debug = Debug('nuxt:')
debug.color = 5

export default class Nuxt extends Tapable {
  constructor (_options = {}) {
    super()

    this.options = Options.from(_options)

    // Paths for resolving requires from `rootDir`
    this.nodeModulePaths = Module._nodeModulePaths(this.options.rootDir)

    this.initialized = false
    this.errorHandler = this.errorHandler.bind(this)

    // Create instance of core components
    this.moduleContainer = new ModuleContainer(this)
    this.renderer = new Renderer(this)

    // Backward compatibility
    this.render = this.renderer.app
    this.renderRoute = this.renderer.renderRoute.bind(this.renderer)
    this.renderAndGetWindow = this.renderer.renderAndGetWindow.bind(this.renderer)

    // Default Show Open if Nuxt is not listening
    this.showOpen = () => {}

    this._ready = this.ready().catch(this.errorHandler)
  }

  async ready () {
    if (this._ready) {
      return this._ready
    }

    await this.moduleContainer._ready()
    await this.applyPluginsAsync('ready')
    await this.renderer._ready()

    this.initialized = true
    return this
  }

  listen (port = 3000, host = 'localhost') {
    // Update showOpen
    this.showOpen = () => {
      const _host = host === '0.0.0.0' ? 'localhost' : host
      // eslint-disable-next-line no-console
      console.log('\n' + chalk.bgGreen.black(' OPEN ') + chalk.green(` http://${_host}:${port}\n`))
    }

    return new Promise((resolve, reject) => {
      const server = this.renderer.app.listen({ port, host, exclusive: false }, err => {
        /* istanbul ignore if */
        if (err) {
          return reject(err)
        }

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

        resolve(this.applyPluginsAsync('listen', { server, port, host }))
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
    try {
      let resolvedPath = Module._resolveFilename(path, { paths: this.nodeModulePaths })
      return resolvedPath
    } catch (e) {
      // Just continue
    }
    // Shorthand to resolve from project dirs
    if (path.indexOf('@@') === 0 || path.indexOf('~~') === 0) {
      return join(this.options.rootDir, path.substr(2))
    } else if (path.indexOf('@') === 0 || path.indexOf('~') === 0) {
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
