import Module from 'module'
import path from 'path'

import enableDestroy from 'server-destroy'
import _ from 'lodash'
import fs from 'fs-extra'
import consola from 'consola'
import chalk from 'chalk'
import esm from 'esm'

import Options from '../common/options'
import { sequence } from '../common/utils'
import packageJSON from '../../package.json'

import ModuleContainer from './module'
import Renderer from './renderer'

export default class Nuxt {
  constructor(options = {}) {
    this.options = Options.from(options)

    this.readyMessage = null
    this.initialized = false

    // Hooks
    this._hooks = {}
    this.hook = this.hook.bind(this)

    // Create instance of core components
    this.moduleContainer = new ModuleContainer(this)
    this.renderer = new Renderer(this)

    // Backward compatibility
    this.render = this.renderer.app
    this.renderRoute = this.renderer.renderRoute.bind(this.renderer)
    this.renderAndGetWindow = this.renderer.renderAndGetWindow.bind(
      this.renderer
    )

    // ESM Loader
    this.esm = esm(module, {})

    this._ready = this.ready().catch(err => {
      consola.fatal(err)
    })
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

  async callHook(name, ...args) {
    if (!this._hooks[name]) {
      return
    }
    consola.debug(`Call ${name} hooks (${this._hooks[name].length})`)
    try {
      await sequence(this._hooks[name], fn => fn(...args))
    } catch (err) {
      consola.error(err)
      this.callHook('error', err)
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

  showReady(clear = true) {
    if (!this.readyMessage) {
      return
    }

    consola.ready({
      message: this.readyMessage,
      badge: true,
      clear
    })
  }

  listen(port = 3000, host = 'localhost') {
    return this.ready().then(() => new Promise((resolve, reject) => {
      const server = this.renderer.app.listen(
        { port, host, exclusive: false },
        err => {
          /* istanbul ignore if */
          if (err) {
            return reject(err)
          }

          let { host, port } = server.address()
          if (['127.0.0.1', '0.0.0.0'].includes(host)) {
            host = 'localhost'
          }

          const listenURL = chalk.underline.blue(`http://${host}:${port}`)
          this.readyMessage = `Listening on ${listenURL}`

          // Close server on nuxt close
          this.hook(
            'close',
            () =>
              new Promise((resolve, reject) => {
                // Destroy server by forcing every connection to be closed
                server.destroy(err => {
                  consola.debug('server closed')
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
    }))
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

  requireModule(_path, opts = {}) {
    const _resovledPath = this.resolvePath(_path)
    const m = opts.esm === false ? require(_resovledPath) : this.esm(_resovledPath)
    return (m && m.default) || m
  }

  async close(callback) {
    await this.callHook('close', this)

    /* istanbul ignore if */
    if (typeof callback === 'function') {
      await callback()
    }
  }
}
