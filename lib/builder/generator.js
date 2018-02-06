const {
  copy,
  remove,
  writeFile,
  mkdirp,
  removeSync,
  existsSync
} = require('fs-extra')
const _ = require('lodash')
const { resolve, join, dirname, sep } = require('path')
const { minify } = require('html-minifier')
const Chalk = require('chalk')
const { printWarn } = require('../common/utils')

const {
  isUrl,
  promisifyRoute,
  waitFor,
  flatRoutes,
  pe
} = require('../common/utils')

module.exports = class Generator {
  constructor(nuxt, builder) {
    this.nuxt = nuxt
    this.options = nuxt.options
    this.builder = builder

    // Set variables
    this.staticRoutes = resolve(this.options.srcDir, this.options.dir.static)
    this.srcBuiltPath = resolve(this.options.buildDir, 'dist')
    this.distPath = resolve(this.options.rootDir, this.options.generate.dir)
    this.distNuxtPath = join(
      this.distPath,
      isUrl(this.options.build.publicPath) ? '' : this.options.build.publicPath
    )
  }

  async generate({ build = true, init = true } = {}) {
    await this.initiate({ build, init })

    const routes = await this.initRoutes()

    const errors = await this.generateRoutes(routes)
    await this.afterGenerate()

    // Done hook
    await this.nuxt.callHook('generate:done', this, errors)

    return { errors }
  }

  async initiate({ build = true, init = true } = {}) {
    // Wait for nuxt be ready
    await this.nuxt.ready()

    // Call before hook
    await this.nuxt.callHook('generate:before', this, this.options.generate)

    if (build) {
      // Add flag to set process.static
      this.builder.forGenerate()

      // Start build process
      await this.builder.build()
    }

    // Initialize dist directory
    if (init) {
      await this.initDist()
    }
  }

  async initRoutes(...args) {
    // Resolve config.generate.routes promises before generating the routes
    let generateRoutes = []
    if (this.options.router.mode !== 'hash') {
      try {
        generateRoutes = await promisifyRoute(
          this.options.generate.routes || [],
          ...args
        )
      } catch (e) {
        console.error('Could not resolve routes') // eslint-disable-line no-console
        throw e // eslint-disable-line no-unreachable
      }
    }
    // Generate only index.html for router.mode = 'hash'
    let routes =
      this.options.router.mode === 'hash'
        ? ['/']
        : flatRoutes(this.options.router.routes)
    routes = this.decorateWithPayloads(routes, generateRoutes)

    // extendRoutes hook
    await this.nuxt.callHook('generate:extendRoutes', routes)

    return routes
  }

  async generateRoutes(routes) {
    let errors = []

    // Start generate process
    while (routes.length) {
      let n = 0
      await Promise.all(
        routes
          .splice(0, this.options.generate.concurrency)
          .map(async ({ route, payload }) => {
            await waitFor(n++ * this.options.generate.interval)
            await this.generateRoute({ route, payload, errors })
          })
      )
    }

    // Improve string representation for errors
    errors.toString = () => this._formatErrors(errors)

    return errors
  }

  _formatErrors(errors) {
    return errors
      .map(({ type, route, error }) => {
        const isHandled = type === 'handled'
        const bgColor = isHandled ? 'bgYellow' : 'bgRed'
        const color = isHandled ? 'yellow' : 'red'

        let line =
          Chalk.black[bgColor](' ROUTE ') + Chalk[color](` ${route}\n\n`)

        if (isHandled) {
          line += Chalk.grey(JSON.stringify(error, undefined, 2) + '\n')
        } else {
          line += Chalk.grey(pe.render(error))
        }

        return line
      })
      .join('\n')
  }

  async afterGenerate() {
    let { fallback } = this.options.generate

    // Disable SPA fallback if value isn't true or a string
    if (fallback !== true && typeof fallback !== 'string') return

    const fallbackPath = join(this.distPath, fallback)

    // Prevent conflicts
    if (existsSync(fallbackPath)) {
      printWarn(`SPA fallback was configured, but the configured path (${fallbackPath}) already exists.`)
      return
    }

    // Render and write the SPA template to the fallback path
    const { html } = await this.nuxt.renderRoute('/', { spa: true })
    await writeFile(fallbackPath, html, 'utf8')
  }

  async initDist() {
    // Clean destination folder
    await remove(this.distPath)

    await this.nuxt.callHook('generate:distRemoved', this)

    // Copy static and built files
    /* istanbul ignore if */
    if (existsSync(this.staticRoutes)) {
      await copy(this.staticRoutes, this.distPath)
    }
    await copy(this.srcBuiltPath, this.distNuxtPath)

    // Add .nojekyll file to let Github Pages add the _nuxt/ folder
    // https://help.github.com/articles/files-that-start-with-an-underscore-are-missing/
    const nojekyllPath = resolve(this.distPath, '.nojekyll')
    writeFile(nojekyllPath, '')

    // Cleanup SSR related files
    const extraFiles = [
      'index.spa.html',
      'index.ssr.html',
      'server-bundle.json',
      'vue-ssr-client-manifest.json'
    ].map(file => resolve(this.distNuxtPath, file))

    extraFiles.forEach(file => {
      if (existsSync(file)) {
        removeSync(file)
      }
    })

    await this.nuxt.callHook('generate:distCopied', this)
  }

  decorateWithPayloads(routes, generateRoutes) {
    let routeMap = {}
    // Fill routeMap for known routes
    routes.forEach(route => {
      routeMap[route] = {
        route,
        payload: null
      }
    })
    // Fill routeMap with given generate.routes
    generateRoutes.forEach(route => {
      // route is either a string or like { route : '/my_route/1', payload: {} }
      const path = _.isString(route) ? route : route.route
      routeMap[path] = {
        route: path,
        payload: route.payload || null
      }
    })
    return _.values(routeMap)
  }

  async generateRoute({ route, payload = {}, errors = [] }) {
    let html
    const pageErrors = []

    try {
      const res = await this.nuxt.renderer.renderRoute(route, {
        _generate: true,
        payload
      })
      html = res.html
      if (res.error) {
        pageErrors.push({ type: 'handled', route, error: res.error })
      }
    } catch (err) {
      /* istanbul ignore next */
      pageErrors.push({ type: 'unhandled', route, error: err })
      Array.prototype.push.apply(errors, pageErrors)

      await this.nuxt.callHook('generate:routeFailed', {
        route,
        errors: pageErrors
      })

      return false
    }

    if (this.options.generate.minify) {
      try {
        html = minify(html, this.options.generate.minify)
      } catch (err) /* istanbul ignore next */ {
        const minifyErr = new Error(
          `HTML minification failed. Make sure the route generates valid HTML. Failed HTML:\n ${html}`
        )
        pageErrors.push({ type: 'unhandled', route, error: minifyErr })
      }
    }

    let path

    if (this.options.generate.subFolders) {
      path = join(route, sep, 'index.html') // /about -> /about/index.html
      path = path === '/404/index.html' ? '/404.html' : path // /404 -> /404.html
    } else {
      path =
        route.length > 1 ? join(sep, route + '.html') : join(sep, 'index.html')
    }

    // Call hook to let user update the path & html
    const page = { route, path, html }
    await this.nuxt.callHook('generate:page', page)

    page.path = join(this.distPath, page.path)

    // Make sure the sub folders are created
    await mkdirp(dirname(page.path))
    await writeFile(page.path, page.html, 'utf8')

    await this.nuxt.callHook('generate:routeCreated', {
      route,
      path: page.path,
      errors: pageErrors
    })

    if (pageErrors.length) {
      Array.prototype.push.apply(errors, pageErrors)
    }

    return true
  }
}
