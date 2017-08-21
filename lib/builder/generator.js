import { copy, remove, writeFile, mkdirp, removeSync, existsSync } from 'fs-extra'
import _ from 'lodash'
import { resolve, join, dirname, sep } from 'path'
import { minify } from 'html-minifier'
import Tapable from 'tappable'
import { isUrl, promisifyRoute, waitFor, flatRoutes } from 'utils'
import Debug from 'debug'

const debug = Debug('nuxt:generate')

export default class Generator extends Tapable {
  constructor (nuxt, builder) {
    super()
    this.nuxt = nuxt
    this.options = nuxt.options
    this.builder = builder

    // Set variables
    this.generateRoutes = resolve(this.options.srcDir, 'static')
    this.srcBuiltPath = resolve(this.options.buildDir, 'dist')
    this.distPath = resolve(this.options.rootDir, this.options.generate.dir)
    this.distNuxtPath = join(this.distPath, (isUrl(this.options.build.publicPath) ? '' : this.options.build.publicPath))
  }

  async generate ({ build = true, init = true } = {}) {
    const s = Date.now()
    let errors = []

    // Add flag to set process.static
    this.builder.forGenerate()

    // Wait for nuxt be ready
    await this.nuxt.ready()

    // Start build process
    if (build) {
      await this.builder.build()
    }

    await this.nuxt.applyPluginsAsync('generator', this)

    // Initialize dist directory
    if (init) {
      await this.initDist()
    }

    // Resolve config.generate.routes promises before generating the routes
    let generateRoutes = []
    if (this.options.router.mode !== 'hash') {
      try {
        console.log('Generating routes') // eslint-disable-line no-console
        generateRoutes = await promisifyRoute(this.options.generate.routes || [])
        await this.applyPluginsAsync('generateRoutes', { generator: this, generateRoutes })
      } catch (e) {
        console.error('Could not resolve routes') // eslint-disable-line no-console
        console.error(e) // eslint-disable-line no-console
        throw e // eslint-disable-line no-unreachable
      }
    }

    // Generate only index.html for router.mode = 'hash'
    let routes = (this.options.router.mode === 'hash') ? ['/'] : flatRoutes(this.options.router.routes)
    routes = this.decorateWithPayloads(routes, generateRoutes)

    await this.applyPluginsAsync('generate', { generator: this, routes })

    // Start generate process
    while (routes.length) {
      let n = 0
      await Promise.all(routes.splice(0, this.options.generate.concurrency).map(async ({ route, payload }) => {
        await waitFor(n++ * this.options.generate.interval)
        await this.generateRoute({ route, payload, errors })
      }))
    }

    // Copy /index.html to /200.html for surge SPA
    // https://surge.sh/help/adding-a-200-page-for-client-side-routing
    const _200Path = join(this.distPath, '200.html')
    if (!existsSync(_200Path)) {
      await copy(join(this.distPath, 'index.html'), _200Path)
    }

    const duration = Math.round((Date.now() - s) / 100) / 10
    debug(`HTML Files generated in ${duration}s`)

    if (errors.length) {
      const report = errors.map(({ type, route, error }) => {
        /* istanbul ignore if */
        if (type === 'unhandled') {
          return `Route: '${route}'\n${error.stack}`
        } else {
          return `Route: '${route}' thrown an error: \n` + JSON.stringify(error)
        }
      })
      console.error('==== Error report ==== \n' + report.join('\n\n')) // eslint-disable-line no-console
    }

    await this.applyPluginsAsync('generated', this)

    return { duration, errors }
  }

  async initDist () {
    // Clean destination folder
    await remove(this.distPath)
    debug('Destination folder cleaned')

    // Copy static and built files
    /* istanbul ignore if */
    if (existsSync(this.generateRoutes)) {
      await copy(this.generateRoutes, this.distPath)
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

    debug('Static & build files copied')
  }

  decorateWithPayloads (routes, generateRoutes) {
    let routeMap = {}
    // Fill routeMap for known routes
    routes.forEach((route) => {
      routeMap[route] = {
        route,
        payload: null
      }
    })
    // Fill routeMap with given generate.routes
    generateRoutes.forEach((route) => {
      // route is either a string or like {route : "/my_route/1"}
      const path = _.isString(route) ? route : route.route
      routeMap[path] = {
        route: path,
        payload: route.payload || null
      }
    })
    return _.values(routeMap)
  }

  async generateRoute ({ route, payload = {}, errors = [] }) {
    let html

    try {
      const res = await this.nuxt.renderer.renderRoute(route, { _generate: true, payload })
      html = res.html
      if (res.error) {
        errors.push({ type: 'handled', route, error: res.error })
      }
    } catch (err) {
      /* istanbul ignore next */
      return errors.push({ type: 'unhandled', route, error: err })
    }

    if (this.options.generate.minify) {
      try {
        html = minify(html, this.options.generate.minify)
      } catch (err) /* istanbul ignore next */ {
        const minifyErr = new Error(`HTML minification failed. Make sure the route generates valid HTML. Failed HTML:\n ${html}`)
        errors.push({ type: 'unhandled', route, error: minifyErr })
      }
    }

    let path = join(route, sep, 'index.html') // /about -> /about/index.html
    path = (path === '/404/index.html') ? '/404.html' : path // /404 -> /404.html
    debug('Generate file: ' + path)
    path = join(this.distPath, path)

    // Make sure the sub folders are created
    await mkdirp(dirname(path))
    await writeFile(path, html, 'utf8')

    return true
  }
}
