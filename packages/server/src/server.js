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
import createModernMiddleware from './middleware/modern'
import createTimingMiddleware from './middleware/timing'

export default class Server {
  constructor(nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options

    this.globals = determineGlobals(nuxt.options.globalName, nuxt.options.globals)

    this.publicPath = isUrl(this.options.build.publicPath)
      ? this.options.build._publicPath
      : this.options.build.publicPath

    // Runtime shared resources
    this.resources = {}

    // Will be available on dev
    this.devMiddleware = null
    this.hotMiddleware = null

    // Will be set after listen
    this.listeners = []

    // Create new connect instance
    this.app = connect()

    // Close hook
    this.nuxt.hook('close', () => this.close())
  }

  async ready() {
    await this.nuxt.callHook('render:before', this, this.options.render)

    // Initialize vue-renderer
    const { VueRenderer } = await import('@nuxt/vue-renderer')

    const context = new ServerContext(this)
    this.renderer = new VueRenderer(context)
    await this.renderer.ready()

    // Setup nuxt middleware
    await this.setupMiddleware()

    // Call done hook
    await this.nuxt.callHook('render:done', this)
  }

  async setupMiddleware() {
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

    const modernMiddleware = createModernMiddleware({
      context: this.renderer.context
    })

    // Add webpack middleware support only for development
    if (this.options.dev) {
      this.useMiddleware(modernMiddleware)
      this.useMiddleware(async (req, res, next) => {
        const name = req.devModernMode ? 'modern' : 'client'
        if (this.devMiddleware && this.devMiddleware[name]) {
          await this.devMiddleware[name](req, res)
        }
        if (this.hotMiddleware && this.hotMiddleware[name]) {
          await this.hotMiddleware[name](req, res)
        }
        next()
      })
    }

    // open in editor for debug mode only
    if (this.options.debug && this.options.dev) {
      this.useMiddleware({
        path: '__open-in-editor',
        handler: launchMiddleware(this.options.editor)
      })
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
      this.useMiddleware(modernMiddleware)
    }

    // Add user provided middleware
    for (const m of this.options.serverMiddleware) {
      this.useMiddleware(m)
    }

    const { fallback } = this.options.render
    if (fallback) {
      // Graceful 404 errors for dist files
      if (fallback.dist) {
        this.useMiddleware({
          path: this.publicPath,
          handler: servePlaceholder(fallback.dist)
        })
      }

      // Graceful 404 errors for other paths
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

    // Error middleware for errors that occurred in middleware that declared above
    // Middleware should exactly take 4 arguments
    // https://github.com/senchalabs/connect#error-middleware

    // Apply errorMiddleware from modules first
    await this.nuxt.callHook('render:errorMiddleware', this.app)

    // Apply errorMiddleware from Nuxt
    this.useMiddleware(errorMiddleware({
      resources: this.resources,
      options: this.options
    }))
  }

  useMiddleware(middleware) {
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

  renderRoute() {
    return this.renderer.renderRoute.apply(this.renderer, arguments)
  }

  loadResources() {
    return this.renderer.loadResources.apply(this.renderer, arguments)
  }

  renderAndGetWindow(url, opts = {}) {
    return renderAndGetWindow(url, opts, {
      loadedCallback: this.globals.loadedCallback,
      ssr: this.options.render.ssr,
      globals: this.globals
    })
  }

  async listen(port, host, socket) {
    // Create a new listener
    const listener = new Listener({
      port: isNaN(parseInt(port)) ? this.options.server.port : port,
      host: host || this.options.server.host,
      socket: socket || this.options.server.socket,
      https: this.options.server.https,
      app: this.app,
      dev: this.options.dev
    })

    // Listen
    await listener.listen()

    // Push listener to this.listeners
    this.listeners.push(listener)

    await this.nuxt.callHook('listen', listener.server, listener)
  }

  async close() {
    if (this.__closed) {
      return
    }
    this.__closed = true

    for (const listener of this.listeners) {
      await listener.close()
    }
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
