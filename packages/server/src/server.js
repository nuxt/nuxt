import path from 'path'
import consola from 'consola'
import launchMiddleware from 'launch-editor-middleware'
import serveStatic from 'serve-static'
import servePlaceholder from 'serve-placeholder'
import connect from 'connect'
import { determineGlobals, isUrl } from '@nuxt/utils'

import ServerContext from './context'
import renderAndGetWindow from './jsdom'
import nuxtMiddleware from './middleware/nuxt'
import errorMiddleware from './middleware/error'
import Listener from './listener'
import createTimingMiddleware from './middleware/timing'

export default class Server {
  constructor (nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options

    this.globals = determineGlobals(nuxt.options.globalName, nuxt.options.globals)

    this.publicPath = isUrl(this.options.build.publicPath)
      ? this.options.build._publicPath
      : this.options.build.publicPath

    // Runtime shared resources
    this.resources = {}

    // Will be set after listen
    this.listeners = []

    // Create new connect instance
    this.app = connect()

    // Close hook
    this.nuxt.hook('close', () => this.close())

    // devMiddleware placeholder
    if (this.options.dev) {
      this.nuxt.hook('server:devMiddleware', (devMiddleware) => {
        this.devMiddleware = devMiddleware
      })
    }
  }

  async ready () {
    if (this._readyCalled) {
      return this
    }
    this._readyCalled = true

    await this.nuxt.callHook('render:before', this, this.options.render)

    // Initialize vue-renderer
    const { VueRenderer } = await import('@nuxt/vue-renderer')

    this.serverContext = new ServerContext(this)
    this.renderer = new VueRenderer(this.serverContext)
    await this.renderer.ready()

    // Setup nuxt middleware
    await this.setupMiddleware()

    // Call done hook
    await this.nuxt.callHook('render:done', this)

    return this
  }

  async setupMiddleware () {
    // Apply setupMiddleware from modules first
    await this.nuxt.callHook('render:setupMiddleware', this.app)

    // Compression middleware for production
    if (!this.options.dev) {
      const { compressor } = this.options.render
      if (typeof compressor === 'object') {
        // If only setting for `compression` are provided, require the module and insert
        const compression = this.nuxt.resolver.requireModule('compression')
        this.useMiddleware(compression(compressor))
      } else if (compressor) {
        // Else, require own compression middleware if compressor is actually truthy
        this.useMiddleware(compressor)
      }
    }

    if (this.options.server.timing) {
      this.useMiddleware(createTimingMiddleware(this.options.server.timing))
    }

    // For serving static/ files to /
    const staticMiddleware = serveStatic(
      path.resolve(this.options.srcDir, this.options.dir.static),
      this.options.render.static
    )
    staticMiddleware.prefix = this.options.render.static.prefix
    this.useMiddleware(staticMiddleware)

    // Serve .nuxt/dist/client files only for production
    // For dev they will be served with devMiddleware
    if (!this.options.dev) {
      const distDir = path.resolve(this.options.buildDir, 'dist', 'client')
      this.useMiddleware({
        path: this.publicPath,
        handler: serveStatic(
          distDir,
          this.options.render.dist
        )
      })
    }

    // Dev middleware
    if (this.options.dev) {
      this.useMiddleware((req, res, next) => {
        if (!this.devMiddleware) {
          return next()
        }
        this.devMiddleware(req, res, next)
      })

      // open in editor for debug mode only
      if (this.options.debug) {
        this.useMiddleware({
          path: '__open-in-editor',
          handler: launchMiddleware(this.options.editor)
        })
      }
    }

    // Add user provided middleware
    for (const m of this.options.serverMiddleware) {
      this.useMiddleware(m)
    }

    // Graceful 404 error handler
    const { fallback } = this.options.render
    if (fallback) {
      // Dist files
      if (fallback.dist) {
        this.useMiddleware({
          path: this.publicPath,
          handler: servePlaceholder(fallback.dist)
        })
      }

      // Other paths
      if (fallback.static) {
        this.useMiddleware({
          path: '/',
          handler: servePlaceholder(fallback.static)
        })
      }
    }

    // Finally use nuxtMiddleware
    this.useMiddleware(nuxtMiddleware({
      options: this.options,
      nuxt: this.nuxt,
      renderRoute: this.renderRoute.bind(this),
      resources: this.resources
    }))

    // Apply errorMiddleware from modules first
    await this.nuxt.callHook('render:errorMiddleware', this.app)

    // Error middleware for errors that occurred in middleware that declared above
    this.useMiddleware(errorMiddleware({
      resources: this.resources,
      options: this.options
    }))
  }

  useMiddleware (middleware) {
    let handler = middleware.handler || middleware

    // Resolve handler setup as string (path)
    if (typeof handler === 'string') {
      try {
        const requiredModuleFromHandlerPath = this.nuxt.resolver.requireModule(handler)

        // In case the "handler" is not derived from an object but is a normal string, another object with
        // path and handler could be the result

        // If the required module has handler, treat the module as new "middleware" object
        if (requiredModuleFromHandlerPath.handler) {
          middleware = requiredModuleFromHandlerPath
        }

        handler = requiredModuleFromHandlerPath.handler || requiredModuleFromHandlerPath
      } catch (err) {
        consola.error(err)
        // Throw error in production mode
        if (!this.options.dev) {
          throw err
        }
      }
    }

    // Resolve path
    const path = (
      (middleware.prefix !== false ? this.options.router.base : '') +
      (typeof middleware.path === 'string' ? middleware.path : '')
    ).replace(/\/\//g, '/')

    // Use middleware
    this.app.use(path, handler)
  }

  renderRoute () {
    return this.renderer.renderRoute.apply(this.renderer, arguments)
  }

  loadResources () {
    return this.renderer.loadResources.apply(this.renderer, arguments)
  }

  renderAndGetWindow (url, opts = {}) {
    return renderAndGetWindow(url, opts, {
      loadedCallback: this.globals.loadedCallback,
      ssr: this.options.render.ssr,
      globals: this.globals
    })
  }

  async listen (port, host, socket) {
    // Ensure nuxt is ready
    await this.nuxt.ready()

    // Create a new listener
    const listener = new Listener({
      port: isNaN(parseInt(port)) ? this.options.server.port : port,
      host: host || this.options.server.host,
      socket: socket || this.options.server.socket,
      https: this.options.server.https,
      app: this.app,
      dev: this.options.dev,
      baseURL: this.options.router.base
    })

    // Listen
    await listener.listen()

    // Push listener to this.listeners
    this.listeners.push(listener)

    await this.nuxt.callHook('listen', listener.server, listener)

    return listener
  }

  async close () {
    if (this.__closed) {
      return
    }
    this.__closed = true

    await Promise.all(this.listeners.map(l => l.close()))

    this.listeners = []

    if (typeof this.renderer.close === 'function') {
      await this.renderer.close()
    }

    this.app.removeAllListeners()
    this.app = null

    for (const key in this.resources) {
      delete this.resources[key]
    }
  }
}
