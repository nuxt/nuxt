const debug = require('debug')('nuxt:render')
debug.color = 4 // force blue color
const co = require('co')
const { urlJoin } = require('./utils')
const { getContext } = require('./utils')

exports.render = function (req, res) {
  if (!this.renderer && !this.dev) {
    console.error('> No build files found, please run `nuxt build` before launching `nuxt start`') // eslint-disable-line no-console
    process.exit(1)
  }
  if (!this.renderer) {
    setTimeout(() => {
      this.render(req, res)
    }, 1000)
    return
  }
  const self = this
  const context = getContext(req, res)
  co(function * () {
    if (self.dev) {
      // Call webpack middlewares only in development
      yield self.webpackDevMiddleware(req, res)
      yield self.webpackHotMiddleware(req, res)
    }
    // If base in req.url, remove it for the middlewares and vue-router
    if (self.options.router.base !== '/' && req.url.indexOf(self.options.router.base) === 0) {
      // Compatibility with base url for dev server
      req.url = req.url.replace(self.options.router.base, '/')
    }
    // Serve static/ files
    yield self.serveStatic(req, res)
    // Serve .nuxt/dist/ files (only for production)
    if (!self.dev && self._nuxtRegexp.test(req.url)) {
      const url = req.url
      req.url = req.url.replace(self._nuxtRegexp, '/')
      yield self.serveStaticNuxt(req, res)
      req.url = url
    }
  })
  .then(() => {
    if (this.dev && this._nuxtRegexp.test(req.url) && req.url.includes('.hot-update.json')) {
      res.statusCode = 404
      return res.end()
    }
    return this.renderRoute(req.url, context)
  })
  .then(({ html, error }) => {
    if (error) {
      res.statusCode = context.nuxt.error.statusCode || 500
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(html))
    res.end(html, 'utf8')
  })
  .catch((err) => {
    res.statusCode = 500
    res.end(this.errorTemplate({ err }), 'utf8')
  })
}

exports.renderRoute = function (url, context = {}) {
  debug(`Rendering url ${url}`)
  // Add url and isSever to the context
  context.url = url
  context.isServer = true
  // Call rendertoSting from the bundleRenderer and generate the HTML (will update the context as well)
  const self = this
  return co(function * () {
    let app = yield self.renderToString(context)
    if (context.nuxt && context.nuxt.error instanceof Error) {
      context.nuxt.error = { statusCode: 500, message: context.nuxt.error.message }
    }
    if (context.redirected) {
      app = '<div id="__nuxt"></div>'
    }
    const html = self.appTemplate({
      dev: self.dev, // Use to add the extracted CSS <link> in production
      baseUrl: self.options.router.base,
      APP: app,
      context: context,
      files: {
        css: urlJoin(self.options.router.base, '/_nuxt/', self.options.build.filenames.css),
        vendor: urlJoin(self.options.router.base, '/_nuxt/', self.options.build.filenames.vendor),
        app: urlJoin(self.options.router.base, '/_nuxt/', self.options.build.filenames.app)
      }
    })
    return {
      html,
      error: context.nuxt.error,
      redirected: context.redirected
    }
  })
}

// Function used to do dom checking via jsdom
exports.renderAndGetWindow = function renderAndGetWindow (jsdom, url) {
  const virtualConsole = jsdom.createVirtualConsole().sendTo(console)
  url = url || 'http://localhost:3000'
  return new Promise((resolve, reject) => {
    jsdom.env({
      url: url,
      features: {
        FetchExternalResources: ['script', 'link'],
        ProcessExternalResources: ['script']
      },
      virtualConsole,
      done (err, window) {
        if (err) return reject(err)
        // If Nuxt could not be loaded (error from the server-side)
        if (!window.__NUXT__) {
          return reject({
            message: 'Could not load the nuxt app',
            body: window.document.getElementsByTagName('body')[0].innerHTML
          })
        }
        // Used by nuxt.js to say when the components are loaded and the app ready
        window.onNuxtReady(() => {
          resolve(window)
        })
      }
    })
  })
}
