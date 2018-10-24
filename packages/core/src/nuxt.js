import https from 'https'
import enableDestroy from 'server-destroy'
import isPlainObject from 'lodash/isPlainObject'
import consola from 'consola'
import chalk from 'chalk'

import ip from 'ip'

import { Options, sequence } from '@nuxt/common'

import { version } from '../package.json'
import ModuleContainer from './module'
import Renderer from './renderer'
import Resolver from './resolver'

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
    this.resolver = new Resolver(this)

    // Backward compatibility
    this.render = this.renderer.app
    this.renderRoute = this.renderer.renderRoute.bind(this.renderer)
    this.renderAndGetWindow = this.renderer.renderAndGetWindow.bind(
      this.renderer
    )
    this.resolveAlias = this.resolver.resolveAlias.bind(this)
    this.resolvePath = this.resolver.resolvePath.bind(this)

    this._ready = this.ready().catch((err) => {
      consola.fatal(err)
    })
  }

  static get version() {
    return version
  }

  async ready() {
    if (this._ready) {
      return this._ready
    }

    // Add hooks
    if (isPlainObject(this.options.hooks)) {
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

  async isPortInUse(port) {
    return await new Promise((resolve, reject) => {
      const tester = require('net').createServer()
        .once('error', err => (err.code == 'EADDRINUSE' ? resolve(true) : reject(err)))
        .once('listening', () => tester.once('close', () => resolve(false)).close())
        .listen(port)
    })
  }

  listen(port, host, socket) {
    return this.ready().then(() => new Promise((resolve, reject) => {
      if (!socket && typeof this.options.server.socket === 'string') {
        socket = this.options.server.socket
      }

      const args = { exclusive: false }

      if (socket) {
        args.path = socket
      } else {
        args.port = port || this.options.server.port
        args.host = host || this.options.server.host
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

          let { address: host, port } = server.address();

          const isPortInUse = await this.isPortInUse(port);
          if(isPortInUse) throw `Error: listen EADDRINUSE ${host}:${port}`;

          let listenURL

          if (!socket) {
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

  async close(callback) {
    await this.callHook('close', this)

    /* istanbul ignore if */
    if (typeof callback === 'function') {
      await callback()
    }
  }
}
