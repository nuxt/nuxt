import path from 'path'
import chalk from 'chalk'
import consola from 'consola'
import fsExtra from 'fs-extra'
import htmlMinifier from 'html-minifier'
import { parse } from 'node-html-parser'

import { flatRoutes, isString, isUrl, promisifyRoute, waitFor, urlJoin, TARGETS } from '@nuxt/utils'

export default class Generator {
  constructor (nuxt, builder) {
    this.nuxt = nuxt
    this.options = nuxt.options
    this.builder = builder
    this.isFullStatic = false

    // Set variables
    this.staticRoutes = path.resolve(this.options.srcDir, this.options.dir.static)
    this.srcBuiltPath = path.resolve(this.options.buildDir, 'dist', 'client')
    this.distPath = this.options.generate.dir
    this.distNuxtPath = path.join(
      this.distPath,
      isUrl(this.options.build.publicPath) ? '' : this.options.build.publicPath
    )
    this.generatedRoutes = new Set()
  }

  async generate ({ build = true, init = true } = {}) {
    consola.debug('Initializing generator...')
    await this.initiate({ build, init })

    // Payloads for full static
    if (this.isFullStatic) {
      consola.info('Full static mode activated')
      const exportTime = String(Date.now())
      this.payloadDir = path.join(this.distNuxtPath, 'payloads', exportTime)
      this.payloadPath = urlJoin(this.options.build.publicPath, 'payloads', exportTime)
    }

    consola.debug('Preparing routes for generate...')
    const routes = await this.initRoutes()

    consola.info('Generating pages')
    const errors = await this.generateRoutes(routes)

    await this.afterGenerate()

    // Done hook
    await this.nuxt.callHook('generate:done', this, errors)

    return { errors }
  }

  async initiate ({ build = true, init = true } = {}) {
    // Wait for nuxt be ready
    await this.nuxt.ready()

    // Call before hook
    await this.nuxt.callHook('generate:before', this, this.options.generate)

    if (build) {
      // Add flag to set process.static
      this.builder.forGenerate()

      // Start build process
      await this.builder.build()
      this.isFullStatic = this.options.target === TARGETS.static && this.options.render.ssr && this.options.generate.static
    } else {
      const hasBuilt = await fsExtra.exists(this.srcBuiltPath)
      if (!hasBuilt) {
        throw new Error(
          `No build files found in ${this.srcBuiltPath}.\nPlease run \`nuxt static build\` before calling \`nuxt static export\``
        )
      }
      const config = this.getBuildConfig()
      if (config.target !== TARGETS.static) {
        throw new Error(
          `In order to use \`nuxt static export\`, you need to run \`nuxt static build\``
        )
      }
      this.isFullStatic = config.isFullStatic
      this.options.render.ssr = config.ssr
    }

    // Initialize dist directory
    if (init) {
      await this.initDist()
    }
  }

  async initRoutes (...args) {
    // Resolve config.generate.routes promises before generating the routes
    let generateRoutes = []
    if (this.options.router.mode !== 'hash') {
      try {
        generateRoutes = await promisifyRoute(
          this.options.generate.routes || [],
          ...args
        )
      } catch (e) {
        consola.error('Could not resolve routes')
        throw e // eslint-disable-line no-unreachable
      }
    }
    let routes = []
    // Generate only index.html for router.mode = 'hash' or client-side apps
    if (this.options.router.mode === 'hash') {
      routes = ['/']
    } else {
      routes = flatRoutes(this.getAppRoutes())
    }
    routes = routes.filter(route => this.shouldGenerateRoute(route))
    routes = this.decorateWithPayloads(routes, generateRoutes)

    // extendRoutes hook
    await this.nuxt.callHook('generate:extendRoutes', routes)

    return routes
  }

  shouldGenerateRoute (route) {
    return this.options.generate.exclude.every(regex => !regex.test(route))
  }

  getBuildConfig () {
    return require(path.join(this.options.buildDir, 'nuxt/config.json'))
  }

  getAppRoutes () {
    return require(path.join(this.options.buildDir, 'router/routes.json'))
  }

  async generateRoutes (routes) {
    const errors = []

    // Add routes to the tracked generated routes (for crawler)
    routes.forEach(({ route }) => this.generatedRoutes.add(route))
    // Start generate process
    while (routes.length) {
      let n = 0
      await Promise.all(
        routes
          .splice(0, this.options.generate.concurrency)
          .map(async ({ route, payload }) => {
            await waitFor(n++ * this.options.generate.interval)
            await this.generateRoute({ route, payload, errors }, routes)
          })
      )
    }

    // Improve string representation for errors
    // TODO: Use consola for more consistency
    errors.toString = () => this._formatErrors(errors)

    return errors
  }

  _formatErrors (errors) {
    return errors
      .map(({ type, route, error }) => {
        const isHandled = type === 'handled'
        const color = isHandled ? 'yellow' : 'red'

        let line = chalk[color](` ${route}\n\n`)

        if (isHandled) {
          line += chalk.grey(JSON.stringify(error, undefined, 2) + '\n')
        } else {
          line += chalk.grey(error.stack || error.message || `${error}`)
        }

        return line
      })
      .join('\n')
  }

  async afterGenerate () {
    const { fallback } = this.options.generate

    // Disable SPA fallback if value isn't a non-empty string
    if (typeof fallback !== 'string' || !fallback) {
      return
    }

    const fallbackPath = path.join(this.distPath, fallback)

    // Prevent conflicts
    if (await fsExtra.exists(fallbackPath)) {
      consola.warn(`SPA fallback was configured, but the configured path (${fallbackPath}) already exists.`)
      return
    }

    // Render and write the SPA template to the fallback path
    let { html } = await this.nuxt.server.renderRoute('/', { spa: true })

    try {
      html = this.minifyHtml(html)
    } catch (error) {
      consola.warn('HTML minification failed for SPA fallback')
    }

    await fsExtra.writeFile(fallbackPath, html, 'utf8')
  }

  async initDist () {
    // Clean destination folder
    await fsExtra.remove(this.distPath)

    await this.nuxt.callHook('generate:distRemoved', this)

    // Copy static and built files
    if (await fsExtra.exists(this.staticRoutes)) {
      await fsExtra.copy(this.staticRoutes, this.distPath)
    }
    // Copy .nuxt/dist/client/ to dist/_nuxt/
    await fsExtra.copy(this.srcBuiltPath, this.distNuxtPath)

    if (this.payloadDir) {
      await fsExtra.ensureDir(this.payloadDir)
    }

    // Add .nojekyll file to let GitHub Pages add the _nuxt/ folder
    // https://help.github.com/articles/files-that-start-with-an-underscore-are-missing/
    const nojekyllPath = path.resolve(this.distPath, '.nojekyll')
    fsExtra.writeFile(nojekyllPath, '')

    await this.nuxt.callHook('generate:distCopied', this)
  }

  decorateWithPayloads (routes, generateRoutes) {
    const routeMap = {}
    // Fill routeMap for known routes
    routes.forEach((route) => {
      routeMap[route] = { route, payload: null }
    })
    // Fill routeMap with given generate.routes
    generateRoutes.forEach((route) => {
      // route is either a string or like { route : '/my_route/1', payload: {} }
      const path = isString(route) ? route : route.route
      routeMap[path] = {
        route: path,
        payload: route.payload || null
      }
    })
    return Object.values(routeMap)
  }

  async generateRoute ({ route, payload = {}, errors = [] }, routes) {
    let html
    const pageErrors = []

    try {
      const renderContext = {
        payload,
        static: true,
        payloadPath: this.payloadPath
      }
      const res = await this.nuxt.server.renderRoute(route, renderContext)
      html = res.html

      // If crawler activated and called from generateRoutes()
      if (this.options.generate.crawler && routes) {
        parse(html).querySelectorAll('a').map(el => {
          const href = (el.getAttribute('href') || '').split('?')[0].split('#')[0].trim()

          if (href.startsWith('/') && this.shouldGenerateRoute(href) && !this.generatedRoutes.has(href)) {
            this.generatedRoutes.add(href) // add the route to the tracked list
            routes.push({ route: href })
          }
        })
      }

      // Save payload
      if (this.payloadDir) {
        const payloadFilePath = path.join(this.payloadDir, route, 'payload.json')

        await fsExtra.ensureDir(path.join(this.payloadDir, route))
        await fsExtra.writeFile(payloadFilePath, JSON.stringify({
          data: renderContext.nuxt.data,
          fetch: renderContext.nuxt.fetch
        }), 'utf-8')
        html = await this.addPayloadScript(route, html)
      }

      if (res.error) {
        pageErrors.push({ type: 'handled', route, error: res.error })
      }
    } catch (err) {
      pageErrors.push({ type: 'unhandled', route, error: err })
      errors.push(...pageErrors)

      await this.nuxt.callHook('generate:routeFailed', {
        route,
        errors: pageErrors
      })
      consola.error(this._formatErrors(pageErrors))

      return false
    }

    try {
      html = this.minifyHtml(html)
    } catch (err) {
      const minifyErr = new Error(
        `HTML minification failed. Make sure the route generates valid HTML. Failed HTML:\n ${html}`
      )
      pageErrors.push({ type: 'unhandled', route, error: minifyErr })
    }

    let fileName

    if (this.options.generate.subFolders) {
      fileName = path.join(route, path.sep, 'index.html') // /about -> /about/index.html
      fileName = fileName === '/404/index.html' ? '/404.html' : fileName // /404 -> /404.html
    } else {
      const normalizedRoute = route.replace(/\/$/, '')
      fileName = route.length > 1 ? path.join(path.sep, normalizedRoute + '.html') : path.join(path.sep, 'index.html')
    }

    // Call hook to let user update the path & html
    const page = { route, path: fileName, html }
    await this.nuxt.callHook('generate:page', page)

    page.path = path.join(this.distPath, page.path)

    // Make sure the sub folders are created
    await fsExtra.mkdirp(path.dirname(page.path))
    await fsExtra.writeFile(page.path, page.html, 'utf8')

    await this.nuxt.callHook('generate:routeCreated', {
      route,
      path: page.path,
      errors: pageErrors
    })

    if (pageErrors.length) {
      consola.error('Error generating ' + route)
      errors.push(...pageErrors)
    } else {
      consola.success('Generated ' + route)
    }

    return true
  }

  async addPayloadScript (route, html) {
    const windowNamespace = this.options.globals.context(this.options.globalName)
    const chunks = html.split(`<script>window.${windowNamespace}=`)
    const [pre] = chunks
    const payload = chunks[1].split('</script>').shift()
    const post = chunks[1].split('</script>').slice(1).join('</script>')

    // Write payload.js file
    await fsExtra.writeFile(path.join(this.payloadDir, route, 'payload.js'), `window.${windowNamespace}=${payload}`, 'utf-8')

    return `${pre}<script defer src="${urlJoin(this.payloadPath, route, 'payload.js')}"></script>${post}`
  }

  minifyHtml (html) {
    let minificationOptions = this.options.build.html.minify

    // Legacy: Override minification options with generate.minify if present
    // TODO: Remove in Nuxt version 3
    if (typeof this.options.generate.minify !== 'undefined') {
      minificationOptions = this.options.generate.minify
      consola.warn('generate.minify has been deprecated and will be removed in the next major version.' +
        ' Use build.html.minify instead!')
    }

    if (!minificationOptions) {
      return html
    }

    return htmlMinifier.minify(html, minificationOptions)
  }
}
