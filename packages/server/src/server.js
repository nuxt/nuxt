import path from 'path'
import consola from 'consola'
import launchMiddleware from 'launch-editor-middleware'
import serveStatic from 'serve-static'
import servePlaceholder from 'serve-placeholder'
import connect from 'connect'
import compression from 'compression'
import { determineGlobals, isUrl, urlJoin } from '@nuxt/utils'
import { VueRenderer } from '@nuxt/vue-renderer'
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
      : this.options.build.publicPath.replace(/^\.+\//, '/')

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
        this.useMiddleware(compression(compressor))
      } else if (compressor) {
        // Else, require own compression middleware if compressor is actually truthy
        this.useMiddleware(compressor)
      }
    }

    if (this.options.server.timing) {
      this.useMiddleware(createTimingMiddleware(this.options.server.timing))
    }

    if (this.options.render.static !== false) {
      // For serving static/ files to /
      const staticMiddleware = serveStatic(
        path.resolve(this.options.srcDir, this.options.dir.static),
        this.options.render.static
      )
      staticMiddleware.prefix = this.options.render.static.prefix
      this.useMiddleware(staticMiddleware)
    }

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
        // Safari over-caches JS (breaking HMR) and the seemingly only way to turn
        // this off in dev mode is to set Vary: * header
        // #3828, #9034
        if (req.url.startsWith(this.publicPath) && req.url.endsWith('.js')) {
          res.setHeader('Vary', '*')
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

    // DX: redirect if router.base in development
    const routerBase = this.nuxt.options.router.base
    if (this.options.dev && routerBase !== '/') {
      this.useMiddleware({
        prefix: false,
        handler: (req, res, next) => {
          if (decodeURI(req.url).startsWith(decodeURI(routerBase))) {
            return next()
          }
          const to = urlJoin(routerBase, req.url)
          consola.info(`[Development] Redirecting from \`${decodeURI(req.url)}\` to \`${decodeURI(to)}\` (router.base specified)`)
          res.writeHead(302, {
            Location: to
          })
          res.end()
        }
      })
    }

    // Apply errorMiddleware from modules first
    await this.nuxt.callHook('render:errorMiddleware', this.app)

    // Error middleware for errors that occurred in middleware that declared above
    this.useMiddleware(errorMiddleware({
      resources: this.resources,
      options: this.options
    }))
  }

  _normalizeMiddleware (middleware) {
    // Normalize plain function
    if (typeof middleware === 'function') {
      middleware = { handle: middleware }
    }

    // If a plain string provided as path to middleware
    if (typeof middleware === 'string') {
      middleware = this._requireMiddleware(middleware)
    }

    // #8584
    // shallow clone the middleware before any change is made,
    // in case any following mutation breaks when applied repeatedly.
    middleware = Object.assign({}, middleware)

    // Normalize handler to handle (backward compatibility)
    if (middleware.handler && !middleware.handle) {
      middleware.handle = middleware.handler
      delete middleware.handler
    }

    // Normalize path to route (backward compatibility)
    if (middleware.path && !middleware.route) {
      middleware.route = middleware.path
      delete middleware.path
    }

    // If handle is a string pointing to path
    if (typeof middleware.handle === 'string') {
      Object.assign(middleware, this._requireMiddleware(middleware.handle))
    }

    // No handle
    if (!middleware.handle) {
      middleware.handle = (req, res, next) => {
        next(new Error('ServerMiddleware should expose a handle: ' + middleware.entry))
      }
    }

    // Prefix on handle (proxy-module)
    if (middleware.handle.prefix !== undefined && middleware.prefix === undefined) {
      middleware.prefix = middleware.handle.prefix
    }

    // sub-app (express)
    if (typeof middleware.handle.handle === 'function') {
      const server = middleware.handle
      middleware.handle = server.handle.bind(server)
    }

    return middleware
  }

  _requireMiddleware (entry) {
    // Resolve entry
    entry = this.nuxt.resolver.resolvePath(entry)

    // Require middleware
    let middleware
    try {
      middleware = this.nuxt.resolver.requireModule(entry)
    } catch (error) {
      // Show full error
      consola.error('ServerMiddleware Error:', error)

      // Placeholder for error
      middleware = (req, res, next) => { next(error) }
    }

    // Normalize
    middleware = this._normalizeMiddleware(middleware)

    // Set entry
    middleware.entry = entry

    return middleware
  }

  resolveMiddleware (middleware, fallbackRoute = '/') {
    // Ensure middleware is normalized
    middleware = this._normalizeMiddleware(middleware)

    // Fallback route
    if (!middleware.route) {
      middleware.route = fallbackRoute
    }

    // #8584
    // save the original route before applying defaults
    middleware._originalRoute = middleware.route

    // Resolve final route
    middleware.route = (
      (middleware.prefix !== false ? this.options.router.base : '') +
      (typeof middleware.route === 'string' ? middleware.route : '')
    ).replace(/\/\//g, '/')

    // Strip trailing slash
    if (middleware.route.endsWith('/')) {
      middleware.route = middleware.route.slice(0, -1)
    }

    // Assign _middleware to handle to make accessible from app.stack
    middleware.handle._middleware = middleware

    return middleware
  }

  useMiddleware (middleware) {
    const { route, handle } = this.resolveMiddleware(middleware)
    this.app.use(route, handle)
  }

  replaceMiddleware (query, middleware) {
    let serverStackItem

    if (typeof query === 'string') {
      // Search by entry
      serverStackItem = this.app.stack.find(({ handle }) => handle._middleware && handle._middleware.entry === query)
    } else {
      // Search by reference
      serverStackItem = this.app.stack.find(({ handle }) => handle === query)
    }

    // Stop if item not found
    if (!serverStackItem) {
      return
    }

    // unload middleware
    this.unloadMiddleware(serverStackItem)

    // Resolve middleware
    const { route, handle } = this.resolveMiddleware(
      middleware,
      // #8584 pass the original route as fallback
      serverStackItem.handle._middleware
        ? serverStackItem.handle._middleware._originalRoute
        : serverStackItem.route
    )

    // Update serverStackItem
    serverStackItem.handle = handle

    // Error State
    serverStackItem.route = route

    // Return updated item
    return serverStackItem
  }

  unloadMiddleware ({ handle }) {
    if (handle._middleware && typeof handle._middleware.unload === 'function') {
      handle._middleware.unload()
    }
  }

  serverMiddlewarePaths () {
    return this.app.stack.map(({ handle }) => handle._middleware && handle._middleware.entry).filter(Boolean)
  }

  renderRoute () {
    return this.renderer.renderRoute.apply(this.renderer, arguments)
  }

  loadResources () {
    return this.renderer.loadResources.apply(this.renderer, arguments)
  }

  renderAndGetWindow (url, opts = {}, {
    loadingTimeout = 2000,
    loadedCallback = this.globals.loadedCallback,
    globals = this.globals
  } = {}) {
    return renderAndGetWindow(url, opts, {
      loadingTimeout,
      loadedCallback,
      globals
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

    this.app.stack.forEach(this.unloadMiddleware)
    this.app.removeAllListeners()
    this.app = null

    for (const key in this.resources) {
      delete this.resources[key]
    }
  }
}
