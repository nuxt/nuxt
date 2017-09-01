import _ from 'lodash'
import chokidar from 'chokidar'
import fs, { remove, readFile, writeFile, mkdirp, utimes, existsSync } from 'fs-extra'
import hash from 'hash-sum'
import pify from 'pify'
import webpack from 'webpack'
import serialize from 'serialize-javascript'
import { join, resolve, basename, dirname } from 'path'
import Tapable from 'tappable'
import MFS from 'memory-fs'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import { r, wp, wChunk, createRoutes, sequence, relativeTo, isPureObject } from 'utils'
import Debug from 'debug'
import Glob from 'glob'
import clientWebpackConfig from './webpack/client.config.js'
import serverWebpackConfig from './webpack/server.config.js'
import dllWebpackConfig from './webpack/dll.config.js'
import vueLoaderConfig from './webpack/vue-loader.config'
import styleLoader from './webpack/style-loader'

const debug = Debug('nuxt:build')
debug.color = 2 // Force green color

const glob = pify(Glob)

export default class Builder extends Tapable {
  constructor (nuxt) {
    super()
    this.nuxt = nuxt
    this.isStatic = false // Flag to know if the build is for a generated app
    this.options = nuxt.options

    // Fields that set on build
    this.compiler = null
    this.webpackDevMiddleware = null
    this.webpackHotMiddleware = null

    // Mute stats on dev
    this.webpackStats = this.options.dev ? false : {
      chunks: false,
      children: false,
      modules: false,
      colors: true,
      excludeAssets: [
        /.map$/,
        /index\..+\.html$/,
        /vue-ssr-client-manifest.json/
      ]
    }

    // Helper to resolve build paths
    this.relativeToBuild = (...args) => relativeTo(this.options.buildDir, ...args)

    // Bind styleLoader and vueLoader
    this.styleLoader = styleLoader.bind(this)
    this.vueLoader = vueLoaderConfig.bind(this)

    this._buildStatus = STATUS.INITIAL
  }

  get plugins () {
    return this.options.plugins.map((p, i) => {
      if (typeof p === 'string') p = { src: p }
      p.src = this.nuxt.resolvePath(p.src)
      return { src: p.src, ssr: (p.ssr !== false), name: `plugin${i}` }
    })
  }

  vendor () {
    return [
      'vue',
      'vue-router',
      'vue-meta',
      this.options.store && 'vuex'
    ].concat(this.options.build.vendor).filter(v => v)
  }

  vendorEntries () {
    // Used for dll
    const vendor = this.vendor()
    const vendorEntries = {}
    vendor.forEach(v => {
      try {
        require.resolve(v)
        vendorEntries[v] = [ v ]
      } catch (e) {
        // Ignore
      }
    })
    return vendorEntries
  }

  forGenerate () {
    this.isStatic = true
  }

  async build () {
    // Avoid calling build() method multiple times when dev:true
    /* istanbul ignore if */
    if (this._buildStatus === STATUS.BUILD_DONE && this.options.dev) {
      return this
    }
    // If building
    /* istanbul ignore if */
    if (this._buildStatus === STATUS.BUILDING) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(this.build())
        }, 1000)
      })
    }
    this._buildStatus = STATUS.BUILDING

    // Wait for nuxt ready
    await this.nuxt.ready()

    // Wait for build plugins
    await this.nuxt.applyPluginsAsync('build', this)

    // Babel options
    this.babelOptions = _.defaults(this.options.build.babel, {
      babelrc: false,
      cacheDirectory: !!this.options.dev
    })
    if (!this.babelOptions.babelrc && !this.babelOptions.presets) {
      this.babelOptions.presets = [
        require.resolve('babel-preset-vue-app')
      ]
    }

    // Map postcss plugins into instances on object mode once
    if (isPureObject(this.options.build.postcss)) {
      if (isPureObject(this.options.build.postcss.plugins)) {
        this.options.build.postcss.plugins = Object.keys(this.options.build.postcss.plugins)
          .map(p => {
            const plugin = require(p)
            const opts = this.options.build.postcss.plugins[p]
            if (opts === false) return // Disabled
            const instance = plugin(opts)
            return instance
          }).filter(e => e)
      }
    }

    // Check if pages dir exists and warn if not
    this._nuxtPages = typeof this.options.build.createRoutes !== 'function'
    if (this._nuxtPages) {
      if (!fs.existsSync(join(this.options.srcDir, 'pages'))) {
        let dir = this.options.srcDir
        if (fs.existsSync(join(this.options.srcDir, '..', 'pages'))) {
          throw new Error(`No \`pages\` directory found in ${dir}. Did you mean to run \`nuxt\` in the parent (\`../\`) directory?`)
        } else {
          throw new Error(`Couldn't find a \`pages\` directory in ${dir}. Please create one under the project root`)
        }
      }
    }

    debug(`App root: ${this.options.srcDir}`)
    debug(`Generating ${this.options.buildDir} files...`)

    // Create .nuxt/, .nuxt/components and .nuxt/dist folders
    await remove(r(this.options.buildDir))
    await mkdirp(r(this.options.buildDir, 'components'))
    if (!this.options.dev) {
      await mkdirp(r(this.options.buildDir, 'dist'))
    }

    // Generate routes and interpret the template files
    await this.generateRoutesAndFiles()

    // Start webpack build
    await this.webpackBuild()

    await this.applyPluginsAsync('built', this)

    // Flag to set that building is done
    this._buildStatus = STATUS.BUILD_DONE

    return this
  }

  async generateRoutesAndFiles () {
    debug('Generating files...')
    // -- Templates --
    let templatesFiles = [
      'App.vue',
      'client.js',
      'index.js',
      'middleware.js',
      'router.js',
      'server.js',
      'utils.js',
      'empty.js',
      'components/nuxt-error.vue',
      'components/nuxt-loading.vue',
      'components/nuxt-child.js',
      'components/nuxt-link.js',
      'components/nuxt.vue',
      'components/no-ssr.js',
      'views/app.template.html',
      'views/error.html'
    ]
    const templateVars = {
      options: this.options,
      messages: this.options.messages,
      uniqBy: _.uniqBy,
      isDev: this.options.dev,
      debug: this.options.debug,
      mode: this.options.mode,
      router: this.options.router,
      env: this.options.env,
      head: this.options.head,
      middleware: fs.existsSync(join(this.options.srcDir, 'middleware')),
      store: this.options.store,
      css: this.options.css,
      plugins: this.plugins,
      appPath: './App.vue',
      layouts: Object.assign({}, this.options.layouts),
      loading: typeof this.options.loading === 'string' ? this.relativeToBuild(this.options.srcDir, this.options.loading) : this.options.loading,
      transition: this.options.transition,
      components: {
        ErrorPage: this.options.ErrorPage ? this.relativeToBuild(this.options.ErrorPage) : null
      }
    }

    // -- Layouts --
    if (fs.existsSync(resolve(this.options.srcDir, 'layouts'))) {
      const layoutsFiles = await glob('layouts/*.vue', { cwd: this.options.srcDir })
      let hasErrorLayout = false
      layoutsFiles.forEach((file) => {
        let name = file.split('/').slice(-1)[0].replace(/\.vue$/, '')
        if (name === 'error') {
          hasErrorLayout = true
          return
        }
        templateVars.layouts[name] = this.relativeToBuild(this.options.srcDir, file)
      })
      if (!templateVars.components.ErrorPage && hasErrorLayout) {
        templateVars.components.ErrorPage = this.relativeToBuild(this.options.srcDir, 'layouts/error.vue')
      }
    }
    // If no default layout, create its folder and add the default folder
    if (!templateVars.layouts.default) {
      await mkdirp(r(this.options.buildDir, 'layouts'))
      templatesFiles.push('layouts/default.vue')
      templateVars.layouts.default = './layouts/default.vue'
    }

    // -- Routes --
    debug('Generating routes...')
    // If user defined a custom method to create routes
    if (this._nuxtPages) {
      // Use nuxt.js createRoutes bases on pages/
      const files = await glob('pages/**/*.vue', { cwd: this.options.srcDir })
      templateVars.router.routes = createRoutes(files, this.options.srcDir)
    } else {
      templateVars.router.routes = this.options.build.createRoutes(this.options.srcDir)
    }

    await this.applyPluginsAsync('extendRoutes', { routes: templateVars.router.routes, templateVars, r })

    // router.extendRoutes method
    if (typeof this.options.router.extendRoutes === 'function') {
      // let the user extend the routes
      const extendedRoutes = this.options.router.extendRoutes(templateVars.router.routes, r)
      // Only overwrite routes when something is returned for backwards compatibility
      if (extendedRoutes !== undefined) {
        templateVars.router.routes = extendedRoutes
      }
    }

    // Make routes accessible for other modules and webpack configs
    this.routes = templateVars.router.routes

    // -- Store --
    // Add store if needed
    if (this.options.store) {
      templatesFiles.push('store.js')
    }

    // Resolve template files
    const customTemplateFiles = this.options.build.templates.map(t => t.dst || basename(t.src || t))

    templatesFiles = templatesFiles.map(file => {
      // Skip if custom file was already provided in build.templates[]
      if (customTemplateFiles.indexOf(file) !== -1) {
        return
      }
      // Allow override templates using a file with same name in ${srcDir}/app
      const customPath = r(this.options.srcDir, 'app', file)
      const customFileExists = fs.existsSync(customPath)

      return {
        src: customFileExists
          ? customPath
          : r(this.options.nuxtAppDir, file),
        dst: file,
        custom: customFileExists
      }
    }).filter(i => !!i)

    // -- Custom templates --
    // Add custom template files
    templatesFiles = templatesFiles.concat(this.options.build.templates.map(t => {
      return Object.assign({
        src: r(this.options.srcDir, t.src || t),
        dst: t.dst || basename(t.src || t),
        custom: true
      }, t)
    }))

    // -- Loading indicator --
    if (this.options.loadingIndicator.name) {
      const indicatorPath1 = resolve(this.options.nuxtAppDir, 'views/loading', this.options.loadingIndicator.name + '.html')
      const indicatorPath2 = this.nuxt.resolvePath(this.options.loadingIndicator.name)
      const indicatorPath = existsSync(indicatorPath1) ? indicatorPath1 : (existsSync(indicatorPath2) ? indicatorPath2 : null)
      if (indicatorPath) {
        templatesFiles.push({
          src: indicatorPath,
          dst: 'loading.html',
          options: this.options.loadingIndicator
        })
      } else {
        console.error(`Could not fetch loading indicator: ${this.options.loadingIndicator.name}`) // eslint-disable-line no-console
      }
    }

    await this.applyPluginsAsync('generate', { builder: this, templatesFiles, templateVars })

    // Interpret and move template files to .nuxt/
    await Promise.all(templatesFiles.map(async ({ src, dst, options, custom }) => {
      // Add template to watchers
      this.options.build.watch.push(src)
      // Render template to dst
      const fileContent = await readFile(src, 'utf8')
      const template = _.template(fileContent, {
        imports: {
          serialize,
          hash,
          r,
          wp,
          wChunk,
          resolvePath: this.nuxt.resolvePath.bind(this.nuxt),
          relativeToBuild: this.relativeToBuild
        }
      })
      const content = template(Object.assign({}, templateVars, {
        options: options || {},
        custom,
        src,
        dst
      }))
      const path = r(this.options.buildDir, dst)
      // Ensure parent dir exits
      await mkdirp(dirname(path))
      // Write file
      await writeFile(path, content, 'utf8')
      // Fix webpack loop (https://github.com/webpack/watchpack/issues/25#issuecomment-287789288)
      const dateFS = Date.now() / 1000 - 1000
      return utimes(path, dateFS, dateFS)
    }))

    await this.applyPluginsAsync('generated', this)
  }

  async webpackBuild () {
    debug('Building files...')
    const compilersOptions = []

    // Client
    const clientConfig = clientWebpackConfig.call(this)
    compilersOptions.push(clientConfig)

    // Server
    let serverConfig = null
    if (this.options.build.ssr) {
      serverConfig = serverWebpackConfig.call(this)
      compilersOptions.push(serverConfig)
    }

    // Alias plugins to their real path
    this.plugins.forEach(p => {
      const src = this.relativeToBuild(p.src)

      // Client config
      if (!clientConfig.resolve.alias[p.name]) {
        clientConfig.resolve.alias[p.name] = src
      }

      // Server config
      if (serverConfig && !serverConfig.resolve.alias[p.name]) {
        // Alias to noop for ssr:false plugins
        serverConfig.resolve.alias[p.name] = p.ssr ? src : './empty.js'
      }
    })

    // Make a dll plugin after compile to make next dev builds faster
    if (this.options.build.dll && this.options.dev) {
      compilersOptions.push(dllWebpackConfig.call(this, clientConfig))
    }

    // Simulate webpack multi compiler interface
    // Separate compilers are simpler, safer and faster
    this.compiler = { compilers: [] }
    this.compiler.plugin = (...args) => {
      this.compiler.compilers.forEach(compiler => {
        compiler.plugin(...args)
      })
    }

    // Initialize shared FS and Cache
    const sharedFS = this.options.dev && new MFS()
    const sharedCache = {}

    // Initialize compilers
    compilersOptions.forEach(compilersOption => {
      const compiler = webpack(compilersOption)
      if (sharedFS && !compiler.name.includes('-dll')) {
        compiler.outputFileSystem = sharedFS
      }
      compiler.cache = sharedCache
      this.compiler.compilers.push(compiler)
    })

    // Access to compilers with name
    this.compiler.compilers.forEach(compiler => {
      if (compiler.name) {
        this.compiler[compiler.name] = compiler
      }
    })

    // Run after each compile
    this.compiler.plugin('done', async stats => {
      // Don't reload failed builds
      /* istanbul ignore if */
      if (stats.hasErrors()) {
        return
      }

      // console.log(stats.toString({ chunks: true }))

      // Reload renderer if available
      if (this.nuxt.renderer) {
        this.nuxt.renderer.loadResources(sharedFS || fs)
      }

      await this.applyPluginsAsync('done', { builder: this, stats })
    })

    // Add dev Stuff
    if (this.options.dev) {
      this.webpackDev()
    }

    await this.applyPluginsAsync('compile', { builder: this, compiler: this.compiler })

    // Start Builds
    await sequence(this.compiler.compilers, compiler => new Promise((resolve, reject) => {
      if (this.options.dev) {
        // --- Dev Build ---
        if (compiler.options.name === 'client') {
          // Client watch is started by dev-middleware
          resolve()
        } else if (compiler.options.name.includes('-dll')) {
          // DLL builds should run once
          compiler.run((err, stats) => {
            if (err) {
              return reject(err)
            }
            debug('[DLL] updated')
            resolve()
          })
        } else {
          // Build and watch for changes
          compiler.watch(this.options.watchers.webpack, (err) => {
            /* istanbul ignore if */
            if (err) {
              return reject(err)
            }
            resolve()
          })
        }
      } else {
        // --- Production Build ---
        compiler.run((err, stats) => {
          /* istanbul ignore if */
          if (err) {
            return reject(err)
          }
          if (err) return console.error(err) // eslint-disable-line no-console

          // Show build stats for production
          console.log(stats.toString(this.webpackStats)) // eslint-disable-line no-console

          /* istanbul ignore if */
          if (stats.hasErrors()) {
            return reject(new Error('Webpack build exited with errors'))
          }
          resolve()
        })
      }
    }))

    await this.applyPluginsAsync('compiled', this)
  }

  webpackDev () {
    debug('Adding webpack middleware...')

    // Create webpack dev middleware
    this.webpackDevMiddleware = pify(webpackDevMiddleware(this.compiler.client, Object.assign({
      publicPath: this.options.build.publicPath,
      stats: this.webpackStats,
      noInfo: true,
      quiet: true,
      watchOptions: this.options.watchers.webpack
    }, this.options.build.devMiddleware)))

    this.webpackHotMiddleware = pify(webpackHotMiddleware(this.compiler.client, Object.assign({
      log: false,
      heartbeat: 1000
    }, this.options.build.hotMiddleware)))

    // Inject to renderer instance
    if (this.nuxt.renderer) {
      this.nuxt.renderer.webpackDevMiddleware = this.webpackDevMiddleware
      this.nuxt.renderer.webpackHotMiddleware = this.webpackHotMiddleware
    }

    // Stop webpack middleware on nuxt.close()
    this.nuxt.plugin('close', () => new Promise(resolve => {
      this.webpackDevMiddleware.close(() => resolve())
    }))

    // Start watching files
    this.watchFiles()
  }

  watchFiles () {
    const patterns = [
      r(this.options.srcDir, 'layouts'),
      r(this.options.srcDir, 'store'),
      r(this.options.srcDir, 'middleware'),
      r(this.options.srcDir, 'layouts/*.vue'),
      r(this.options.srcDir, 'layouts/**/*.vue')
    ]
    if (this._nuxtPages) {
      patterns.push(r(this.options.srcDir, 'pages'))
      patterns.push(r(this.options.srcDir, 'pages/*.vue'))
      patterns.push(r(this.options.srcDir, 'pages/**/*.vue'))
    }
    const options = Object.assign({}, this.options.watchers.chokidar, {
      ignoreInitial: true
    })
    /* istanbul ignore next */
    const refreshFiles = _.debounce(() => this.generateRoutesAndFiles(), 200)

    // Watch for src Files
    let filesWatcher = chokidar.watch(patterns, options)
      .on('add', refreshFiles)
      .on('unlink', refreshFiles)

    // Watch for custom provided files
    let customFilesWatcher = chokidar.watch(_.uniq(this.options.build.watch), options)
      .on('change', refreshFiles)

    // Stop watching on nuxt.close()
    this.nuxt.plugin('close', () => {
      filesWatcher.close()
      customFilesWatcher.close()
    })
  }
}

const STATUS = {
  INITIAL: 1,
  BUILD_DONE: 2,
  BUILDING: 3
}
