import Module from 'module'
import path from 'path'

import Debug from 'debug'
import enableDestroy from 'server-destroy'
import _ from 'lodash'
import chalk from 'chalk'
import fs from 'fs-extra'

import Options from '../common/options'
import { sequence, printError } from '../common/utils'
import packageJSON from '../../package.json'
import moduleUtil from '../common/module'

import ModuleContainer from './module'
import Renderer from './renderer'

const debug = Debug('nuxt:')
debug.color = 5

export default class Nuxt {
  constructor(options = {}) {
    this.options = Options.from(options)

    this.initialized = false
    this.onError = this.onError.bind(this)

    // Hooks
    this._hooks = {}
    this.hook = this.hook.bind(this)

    // Create instance of core components
    this.moduleContainer = new ModuleContainer(this)
    this.renderer = new Renderer(this)

    // Backward compatibility
    this.errorHandler = this.onError
    this.render = this.renderer.app
    this.renderRoute = this.renderer.renderRoute.bind(this.renderer)
    this.renderAndGetWindow = this.renderer.renderAndGetWindow.bind(
      this.renderer
    )

    this._ready = this.ready().catch(err => this.onError(err))
  }

  static get version() {
    return packageJSON.version
  }

  async ready() {
    if (this._ready) {
      return this._ready
    }

    // Add hooks
    if (_.isPlainObject(this.options.hooks)) {
      this.addObjectHooks(this.options.hooks)
    } else if (typeof this.options.hooks === 'function') {
      this.options.hooks(this.hook)
    }

    // Await for modules
    await this.moduleContainer.ready()

    // Await for renderer to be ready
    await this.renderer.ready()

    this.initialized = true

    // Call ready hook
    await this.callHook('ready', this)

    return this
  }

  hook(name, fn) {
    if (!name || typeof fn !== 'function') {
      return
    }
    this._hooks[name] = this._hooks[name] || []
    this._hooks[name].push(fn)
  }

  onError(err, from = 'Nuxt error') {
    // Log error to the console if there is not any error listener
    if (!this._hooks['error']) {
      printError(err, from)
      return
    }

    // Call error hooks
    this.callHook('error', err, from)
  }

  async callHook(name, ...args) {
    if (!this._hooks[name]) {
      return
    }
    debug(`Call ${name} hooks (${this._hooks[name].length})`)
    try {
      await sequence(this._hooks[name], fn => fn(...args))
    } catch (err) {
      this.onError(err, name)
    }
  }

  addObjectHooks(hooksObj) {
    Object.keys(hooksObj).forEach(name => {
      let hooks = hooksObj[name]
      hooks = Array.isArray(hooks) ? hooks : [hooks]

      hooks.forEach(hook => {
        this.hook(name, hook)
      })
    })
  }

  listen(port = 3000, host = 'localhost') {
    return new Promise((resolve, reject) => {
      const server = this.renderer.app.listen(
        { port, host, exclusive: false },
        err => {
          /* istanbul ignore if */
          if (err) {
            return reject(err)
          }

          const _host = host === '0.0.0.0' ? 'localhost' : host
          // eslint-disable-next-line no-console
          console.log(
            '\n' +
              chalk.bgGreen.black(' OPEN ') +
              chalk.green(` http://${_host}:${port}\n`)
          )

          // Close server on nuxt close
          this.hook(
            'close',
            () =>
              new Promise((resolve, reject) => {
                // Destroy server by forcing every connection to be closed
                server.destroy(err => {
                  debug('server closed')
                  /* istanbul ignore if */
                  if (err) {
                    return reject(err)
                  }
                  resolve()
                })
              })
          )

          this.callHook('listen', server, { port, host }).then(resolve)
        }
      )

      // Add server.destroy(cb) method
      enableDestroy(server)
    })
  }

  resolveAlias(_path) {
    if (_path.indexOf('@@') === 0 || _path.indexOf('~~') === 0) {
      return path.join(this.options.rootDir, _path.substr(2))
    }

    if (_path.indexOf('@') === 0 || _path.indexOf('~') === 0) {
      return path.join(this.options.srcDir, _path.substr(1))
    }

    return path.resolve(this.options.srcDir, _path)
  }

  resolvePath(_path) {
    // Try to resolve using NPM resolve path first
    try {
      const resolvedPath = Module._resolveFilename(_path, {
        paths: this.options.modulesDir
      })
      return resolvedPath
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        throw error
      }
    }

    let __path = this.resolveAlias(_path)

    if (fs.existsSync(__path)) {
      return __path
    }

    for (let ext of this.options.extensions) {
      if (fs.existsSync(__path + '.' + ext)) {
        return __path + '.' + ext
      }
    }

    throw new Error(`Cannot resolve "${_path}" from "${__path}"`)
  }

  requireModule(name) {
    return moduleUtil.requireModule(this.resolvePath(name))
  }

  async close(callback) {
    await this.callHook('close', this)

    /* istanbul ignore if */
    if (typeof callback === 'function') {
      await callback()
    }
  }
}
