import path from 'path'
import chalk from 'chalk'
import consola from 'consola'
import devalue from 'devalue'
import fsExtra from 'fs-extra'
import { defu } from 'defu'
import htmlMinifier from 'html-minifier'
import { parse } from 'node-html-parser'
import { withTrailingSlash, withoutTrailingSlash, decode } from 'ufo'

import { isFullStatic, flatRoutes, isString, isUrl, promisifyRoute, urlJoin, waitFor, requireModule } from '@nuxt/utils'

export default class Generator {
  constructor (nuxt, builder) {
    this.nuxt = nuxt
    this.options = nuxt.options
    this.builder = builder

    // Set variables
    this.isFullStatic = isFullStatic(this.options)
    if (this.isFullStatic) {
      consola.info(`Full static generation activated`)
    }
    this.staticRoutes = path.resolve(this.options.srcDir, this.options.dir.static)
    this.srcBuiltPath = path.resolve(this.options.buildDir, 'dist', 'client')
    this.distPath = this.options.generate.dir
    this.distNuxtPath = path.join(
      this.distPath,
      isUrl(this.options.build.publicPath) ? '' : this.options.build.publicPath
    )
    // Payloads for full static
    if (this.isFullStatic) {
      const { staticAssets, manifest } = this.options.generate
      this.staticAssetsDir = path.resolve(this.distNuxtPath, staticAssets.dir, staticAssets.version)
      this.staticAssetsBase = urlJoin(this.options.app.cdnURL, this.options.generate.staticAssets.versionBase)
      if (manifest) {
        this.manifest = defu(manifest, {
          routes: []
        })
      }
    }

    // Shared payload
    this._payload = null
    this.setPayload = (payload) => {
      this._payload = defu(payload, this._payload)
    }
  }

  async generate ({ build = true, init = true, failOnError = false } = {}) {
    consola.debug('Initializing generator...')
    await this.initiate({ build, init })

    consola.debug('Preparing routes for generate...')
    const routes = await this.initRoutes()

    consola.info('Generating pages' + (this.isFullStatic ? ' with full static mode' : ''))
    const errors = await this.generateRoutes(routes, failOnError)

    await this.afterGenerate()

    // Save routes manifest for full static
    if (this.manifest) {
      await this.nuxt.callHook('generate:manifest', this.manifest, this)
      const manifestPath = path.join(this.staticAssetsDir, 'manifest.js')
      await fsExtra.ensureDir(this.staticAssetsDir)
      await fsExtra.writeFile(manifestPath, `__NUXT_JSONP__("manifest.js", ${devalue(this.manifest)})`, 'utf-8')
      consola.success('Static manifest generated')
    }

    // Done hook
    await this.nuxt.callHook('generate:done', this, errors)
    await this.nuxt.callHook('export:done', this, { errors })

    return { errors }
  }

  async initiate ({ build = true, init = true } = {}) {
    // Wait for nuxt be ready
    await this.nuxt.ready()

    // Call before hook
    await this.nuxt.callHook('generate:before', this, this.options.generate)
    await this.nuxt.callHook('export:before', this)

    if (build) {
      if (!this.builder) {
        throw new Error(
          `Could not generate. Make sure a Builder instance is passed to the constructor of \`Generator\` class or \`getGenerator\` function \
or disable the build step: \`generate({ build: false })\``)
      }

      // Add flag to set process.static
      this.builder.forGenerate()

      // Start build process
      await this.builder.build()
    } else {
      const hasBuilt = await fsExtra.exists(path.resolve(this.options.buildDir, 'dist', 'server', 'client.manifest.json'))
      if (!hasBuilt) {
        throw new Error(
          `No build files found in ${this.srcBuiltPath}.\nPlease run \`nuxt build\``
        )
      }
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
        throw e
      }
    }
    let routes = []
    // Generate only index.html for router.mode = 'hash' or client-side apps
    if (this.options.router.mode === 'hash') {
      routes = ['/']
    } else {
      try {
        routes = flatRoutes(this.getAppRoutes())
      } catch (err) {
        // Case: where we use custom router.js
        // https://github.com/nuxt-community/router-module/issues/83
        routes = ['/']
      }
    }
    routes = routes.filter(route => this.shouldGenerateRoute(route))
    routes = this.decorateWithPayloads(routes, generateRoutes)

    // extendRoutes hook
    await this.nuxt.callHook('generate:extendRoutes', routes)
    await this.nuxt.callHook('export:extendRoutes', { routes })

    return routes
  }

  shouldGenerateRoute (route) {
    return this.options.generate.exclude.every((regex) => {
      if (typeof regex === 'string') {
        return regex !== route
      }
      return !regex.test(route)
    })
  }

  getBuildConfig () {
    try {
      return requireModule(path.join(this.options.buildDir, 'nuxt/config.json'))
    } catch (err) {
      return null
    }
  }

  getAppRoutes () {
    return requireModule(path.join(this.options.buildDir, 'routes.json'))
  }

  async generateRoutes (routes, failOnError = false) {
    const errors = []
    // Improve string representation for errors
    // TODO: Use consola for more consistency
    errors.toString = () => this._formatErrors(errors)

    this.routes = []
    this.generatedRoutes = new Set()

    routes.forEach(({ route, ...props }) => {
      route = decodeURI(this.normalizeSlash(route))
      this.routes.push({ route, ...props })
      // Add routes to the tracked generated routes (for crawler)
      this.generatedRoutes.add(route)
    })

    // Start generate process
    while (this.routes.length) {
      let n = 0
      if (typeof failOnError === 'number' && errors.length >= failOnError) {
        return errors
      }
      await Promise.all(
        this.routes
          .splice(0, this.options.generate.concurrency)
          .map(async ({ route, payload }) => {
            await waitFor(n++ * this.options.generate.interval)
            await this.generateRoute({ route, payload, errors })
          })
      )
    }
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
    let { html } = await this.nuxt.server.renderRoute('/', {
      spa: true,
      staticAssetsBase: this.staticAssetsBase
    })

    try {
      html = this.minifyHtml(html)
    } catch (error) {
      consola.warn('HTML minification failed for SPA fallback')
    }

    await fsExtra.writeFile(fallbackPath, html, 'utf8')
    consola.success('Client-side fallback created: `' + fallback + '`')
  }

  async initDist () {
    // Clean destination folder
    await fsExtra.emptyDir(this.distPath)

    consola.info(`Generating output directory: ${path.basename(this.distPath)}/`)
    await this.nuxt.callHook('generate:distRemoved', this)
    await this.nuxt.callHook('export:distRemoved', this)

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
    if (this.options.generate.nojekyll) {
      const nojekyllPath = path.resolve(this.distPath, '.nojekyll')
      await fsExtra.writeFile(nojekyllPath, '')
    }

    await this.nuxt.callHook('generate:distCopied', this)
    await this.nuxt.callHook('export:distCopied', this)
  }

  normalizeSlash (route) {
    return this.options.router && this.options.router.trailingSlash ? withTrailingSlash(route) : withoutTrailingSlash(route)
  }

  decorateWithPayloads (routes, generateRoutes) {
    const routeMap = {}
    // Fill routeMap for known routes
    routes.forEach((route) => {
      routeMap[route] = { route: this.normalizeSlash(route), payload: null }
    })
    // Fill routeMap with given generate.routes
    generateRoutes.forEach((route) => {
      // route is either a string or like { route : '/my_route/1', payload: {} }
      const path = isString(route) ? route : route.route
      routeMap[path] = {
        route: this.normalizeSlash(path),
        payload: route.payload || null
      }
    })
    return Object.values(routeMap)
  }

  async generateRoute ({ route, payload = {}, errors = [] }) {
    let html
    const pageErrors = []

    route = this.normalizeSlash(route)

    const setPayload = (_payload) => {
      payload = defu(_payload, payload)
    }

    // Apply shared payload
    if (this._payload) {
      payload = defu(payload, this._payload)
    }

    await this.nuxt.callHook('generate:route', { route, setPayload })
    await this.nuxt.callHook('export:route', { route, setPayload })

    try {
      const renderContext = {
        payload,
        staticAssetsBase: this.staticAssetsBase
      }
      const res = await this.nuxt.server.renderRoute(route, renderContext)
      html = res.html

      // If crawler activated and called from generateRoutes()
      if (this.options.generate.crawler && this.options.render.ssr) {
        parse(html).querySelectorAll('a').map((el) => {
          const sanitizedHref = (el.getAttribute('href') || '')
            .replace(this.options.router.base, '/')
            .split('?')[0]
            .split('#')[0]
            .replace(/\/+$/, '')
            .trim()

          const foundRoute = decodeURI(this.normalizeSlash(sanitizedHref))

          if (foundRoute.startsWith('/') && !foundRoute.startsWith('//') && !path.extname(foundRoute) && this.shouldGenerateRoute(foundRoute) && !this.generatedRoutes.has(foundRoute)) {
            this.generatedRoutes.add(foundRoute)
            this.routes.push({ route: foundRoute })
          }
          return null
        })
      }

      // Save Static Assets
      if (this.staticAssetsDir && renderContext.staticAssets) {
        for (const asset of renderContext.staticAssets) {
          const assetPath = path.join(this.staticAssetsDir, decode(asset.path))
          await fsExtra.ensureDir(path.dirname(assetPath))
          await fsExtra.writeFile(assetPath, asset.src, 'utf-8')
        }
        // Add route to manifest (only if no error and redirect)
        if (this.manifest && (!res.error && !res.redirected)) {
          this.manifest.routes.push(withoutTrailingSlash(route))
        }
      }

      // SPA fallback
      if (res.error) {
        pageErrors.push({ type: 'handled', route, error: res.error })
      }
    } catch (err) {
      pageErrors.push({ type: 'unhandled', route, error: err })
      errors.push(...pageErrors)

      await this.nuxt.callHook('generate:routeFailed', { route, errors: pageErrors })
      await this.nuxt.callHook('export:routeFailed', { route, errors: pageErrors })
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
      fileName = route === '/404'
        ? path.join(path.sep, '404.html') // /404 -> /404.html
        : path.join(route, path.sep, 'index.html') // /about -> /about/index.html
    } else {
      const normalizedRoute = route.replace(/\/$/, '')
      fileName = route.length > 1 ? path.join(path.sep, normalizedRoute + '.html') : path.join(path.sep, 'index.html')
    }

    // Call hook to let user update the path & html
    const page = {
      route,
      path: fileName,
      html,
      exclude: false,
      errors: pageErrors
    }
    page.page = page // Backward compatibility for export:page hook
    await this.nuxt.callHook('generate:page', page)

    if (page.exclude) {
      return false
    }
    page.path = path.join(this.distPath, page.path)

    // Make sure the sub folders are created
    await fsExtra.mkdirp(path.dirname(page.path))
    await fsExtra.writeFile(page.path, page.html, 'utf8')

    await this.nuxt.callHook('generate:routeCreated', { route, path: page.path, errors: pageErrors })
    await this.nuxt.callHook('export:routeCreated', { route, path: page.path, errors: pageErrors })

    if (pageErrors.length) {
      consola.error(`Error generating route "${route}": ${pageErrors.map(e => e.error.message).join(', ')}`)
      errors.push(...pageErrors)
    } else {
      consola.success(`Generated route "${route}"`)
    }

    return true
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
