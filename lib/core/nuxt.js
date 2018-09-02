import Module from 'module'
import { resolve, join } from 'path'
import https from 'https'

import enableDestroy from 'server-destroy'
import _ from 'lodash'
import fs from 'fs-extra'
import consola from 'consola'
import chalk from 'chalk'
import esm from 'esm'
import ip from 'ip'

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
    this.resolvePath = this.resolvePath.bind(this)
    this.resolveAlias = this.resolveAlias.bind(this)

    // ESM Loader
    this.esm = esm(module, {})

    this._ready = this.ready().catch((err) => {
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
      this.addHooks(this.options.hooks)
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
    if (name === 'render:context') {
      name = 'render:routeContext'
      consola.warn('render:context hook has been deprecated, please use render:routeContext')
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

  clearHook(name) {
    if (name) {
      delete this._hooks[name]
    }
  }

  flatHooks(configHooks, hooks = {}, parentName) {
    Object.keys(configHooks).forEach((key) => {
      const subHook = configHooks[key]
      const name = parentName ? `${parentName}:${key}` : key
      if (typeof subHook === 'object' && subHook !== null) {
        this.flatHooks(subHook, hooks, name)
      } else {
        hooks[name] = subHook
      }
    })
    return hooks
  }

  addHooks(configHooks) {
    const hooks = this.flatHooks(configHooks)
    Object.keys(hooks).filter(Boolean).forEach((key) => {
      [].concat(hooks[key]).forEach(h => this.hook(key, h))
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
    this.readyMessage = null
  }

  listen(port = 3000, host = 'localhost', socket = null) {
    return this.ready().then(() => new Promise((resolve, reject) => {
      if (!socket && typeof this.options.server.socket === 'string') {
        socket = this.options.server.socket
      }

      const args = { exclusive: false }

      if (socket) {
        args.path = socket
      } else {
        args.port = port
        args.host = host
      }

      let appServer
      const isHttps = Boolean(this.options.server.https)

      if (isHttps) {
        let httpsOptions

        if (this.options.server.https === true) {
          httpsOptions = {}
        } else {
          httpsOptions = this.options.server.https
        }

        appServer = https.createServer(httpsOptions, this.renderer.app)
      } else {
        appServer = this.renderer.app
      }

      const server = appServer.listen(
        args,
        (err) => {
          /* istanbul ignore if */
          if (err) {
            return reject(err)
          }

          let listenURL

          if (!socket) {
            ({ address: host, port } = server.address())
            if (host === '127.0.0.1') {
              host = 'localhost'
            } else if (host === '0.0.0.0') {
              host = ip.address()
            }

            listenURL = chalk.underline.blue(`http${isHttps ? 's' : ''}://${host}:${port}`)
            this.readyMessage = `Listening on ${listenURL}`
          } else {
            listenURL = chalk.underline.blue(`unix+http://${socket}`)
            this.readyMessage = `Listening on ${listenURL}`
          }

          // Close server on nuxt close
          this.hook(
            'close',
            () =>
              new Promise((resolve, reject) => {
                // Destroy server by forcing every connection to be closed
                server.listening && server.destroy((err) => {
                  consola.debug('server closed')
                  /* istanbul ignore if */
                  if (err) {
                    return reject(err)
                  }
                  resolve()
                })
              })
          )

          if (socket) {
            this.callHook('listen', server, { path: socket }).then(resolve)
          } else {
            this.callHook('listen', server, { port, host }).then(resolve)
          }
        }
      )

      // Add server.destroy(cb) method
      enableDestroy(server)
    }))
  }

  resolveModule(path) {
    try {
      const resolvedPath = Module._resolveFilename(path, {
        paths: this.options.modulesDir
      })

      return resolvedPath
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        return null
      } else {
        throw error
      }
    }
  }

  resolveAlias(path) {
    const modulePath = this.resolveModule(path)

    // Try to resolve it as if it were a regular node_module
    // Package first. Fixes issue with @<org> scoped packages
    if (modulePath != null) {
      return modulePath
    }

    if (path.indexOf('@@') === 0 || path.indexOf('~~') === 0) {
      return join(this.options.rootDir, path.substr(2))
    }

    if (path.indexOf('@') === 0 || path.indexOf('~') === 0) {
      return join(this.options.srcDir, path.substr(1))
    }

    return resolve(this.options.srcDir, path)
  }

  resolvePath(path) {
    const _path = this.resolveAlias(path)

    if (fs.existsSync(_path)) {
      return _path
    }

    for (const ext of this.options.extensions) {
      if (fs.existsSync(_path + '.' + ext)) {
        return _path + '.' + ext
      }
    }

    throw new Error(`Cannot resolve "${path}" from "${_path}"`)
  }

  requireModule(_path, opts = {}) {
    const _resolvedPath = this.resolvePath(_path)
    const m = opts.esm === false ? require(_resolvedPath) : this.esm(_resolvedPath)
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
