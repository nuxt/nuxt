import _ from 'lodash'
import chokidar from 'chokidar'
import fs from 'fs-extra'
import hash from 'hash-sum'
import pify from 'pify'
import webpack from 'webpack'
import serialize from 'serialize-javascript'
import { join, resolve, basename, dirname } from 'path'
import Tapable from 'tappable'
import MFS from 'memory-fs'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import { r, wp, createRoutes, parallel } from 'utils'
import clientWebpackConfig from './webpack/client.config.js'
import serverWebpackConfig from './webpack/server.config.js'

const debug = require('debug')('nuxt:build')
debug.color = 2 // Force green color

const remove = pify(fs.remove)
const readFile = pify(fs.readFile)
const utimes = pify(fs.utimes)
const writeFile = pify(fs.writeFile)
const mkdirp = pify(fs.mkdirp)
const glob = pify(require('glob'))

export default class Builder extends Tapable {
  constructor (nuxt) {
    super()
    this.nuxt = nuxt
    this.options = nuxt.options

    this._buildStatus = STATUS.INITIAL

    // Fields that set on build
    this.compiler = null
    this.webpackDevMiddleware = null
    this.webpackHotMiddleware = null

    // Add extra loaders only if they are not already provided
    let extraDefaults = {}
    if (this.options.build && !Array.isArray(this.options.build.loaders)) {
      extraDefaults.loaders = defaultsLoaders
    }
    if (this.options.build && !Array.isArray(this.options.build.postcss)) {
      extraDefaults.postcss = defaultsPostcss
    }
    _.defaultsDeep(this.options.build, extraDefaults)

    // Mute stats on dev
    this.webpackStats = this.options.dev ? false : {
      chunks: false,
      children: false,
      modules: false,
      colors: true
    }
  }

  async build () {
    // Avoid calling this method multiple times
    if (this._buildStatus === STATUS.BUILD_DONE) {
      return this
    }
    // If building
    if (this._buildStatus === STATUS.BUILDING) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(this.build())
        }, 1000)
      })
    }
    this._buildStatus = STATUS.BUILDING

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
      'components/nuxt-error.vue',
      'components/nuxt-loading.vue',
      'components/nuxt-child.js',
      'components/nuxt-link.js',
      'components/nuxt.vue',
      'views/app.template.html',
      'views/error.html'
    ]
    const templateVars = {
      options: this.options,
      uniqBy: _.uniqBy,
      isDev: this.options.dev,
      router: this.options.router,
      env: this.options.env,
      head: this.options.head,
      middleware: fs.existsSync(join(this.options.srcDir, 'middleware')),
      store: this.options.store,
      css: this.options.css,
      plugins: this.options.plugins.map((p, i) => {
        if (typeof p === 'string') p = { src: p }
        p.src = r(this.options.srcDir, p.src)
        return { src: p.src, ssr: (p.ssr !== false), name: `plugin${i}` }
      }),
      appPath: './App.vue',
      layouts: Object.assign({}, this.options.layouts),
      loading: typeof this.options.loading === 'string' ? r(this.options.srcDir, this.options.loading) : this.options.loading,
      transition: this.options.transition,
      components: {
        ErrorPage: this.options.ErrorPage ? r(this.options.ErrorPage) : null
      }
    }

    // -- Layouts --
    if (fs.existsSync(resolve(this.options.srcDir, 'layouts'))) {
      const layoutsFiles = await glob('layouts/*.vue', { cwd: this.options.srcDir })
      layoutsFiles.forEach((file) => {
        let name = file.split('/').slice(-1)[0].replace('.vue', '')
        if (name === 'error') return
        templateVars.layouts[name] = r(this.options.srcDir, file)
      })
      if (layoutsFiles.includes('layouts/error.vue')) {
        templateVars.components.ErrorPage = r(this.options.srcDir, 'layouts/error.vue')
      }
    }
    // If no default layout, create its folder and add the default folder
    if (!templateVars.layouts.default) {
      await mkdirp(r(this.options.buildDir, 'layouts'))
      templatesFiles.push('layouts/default.vue')
      templateVars.layouts.default = r(__dirname, 'app', 'layouts', 'default.vue')
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
    // router.extendRoutes method
    if (typeof this.options.router.extendRoutes === 'function') {
      // let the user extend the routes
      this.options.router.extendRoutes(templateVars.router.routes, r)
    }

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
          : r(__dirname, '../app', file), // Relative to dist
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
          wp
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
  }

  webpackBuild () {
    debug('Building files...')
    let compilersOptions = []

    // Client
    let clientConfig = clientWebpackConfig.call(this)
    compilersOptions.push(clientConfig)

    // Server
    let serverConfig = serverWebpackConfig.call(this)
    compilersOptions.push(serverConfig)

    // Simulate webpack multi compiler interface
    // Separate compilers are simpler, safer and faster
    this.compiler = { cache: {}, compilers: [] }
    compilersOptions.forEach(compilersOption => {
      this.compiler.compilers.push(webpack(compilersOption))
    })
    this.compiler.plugin = (...args) => {
      this.compiler.compilers.forEach(compiler => {
        compiler.plugin(...args)
      })
    }

    // Access to compilers with name
    this.compiler.compilers.forEach(compiler => {
      if (compiler.name) {
        this.compiler[compiler.name] = compiler
      }
    })

    // Add dev Stuff
    if (this.options.dev) {
      this.webpackDev()
    }

    // Start Builds
    return parallel(this.compiler.compilers, compiler => new Promise((resolve, reject) => {
      let _resolved = false
      const handler = (err, stats) => {
        if (_resolved) return
        _resolved = true
        if (err) {
          return reject(err)
        }
        if (!this.options.dev) {
          // Show build stats for production
          console.log(stats.toString(this.webpackStats)) // eslint-disable-line no-console
          if (stats.hasErrors()) {
            return reject(new Error('Webpack build exited with errors'))
          }
        }
        resolve()
      }
      if (this.options.dev) {
        if (compiler.options.name === 'client') {
          // Client watch is started by dev-middleware
          resolve()
        } else {
          // Build and watch for changes
          compiler.watch(this.options.watchers.webpack, handler)
        }
      } else {
        // Production build
        compiler.run(handler)
      }
    }))
  }

  webpackDev () {
    // Use shared MFS + Cache for faster builds
    let mfs = new MFS()
    this.compiler.compilers.forEach(compiler => {
      compiler.outputFileSystem = mfs
      compiler.cache = this.compiler.cache
    })

    // Run after each compile
    this.compiler.plugin('done', stats => {
      // Don't reload failed builds
      if (stats.hasErrors() || stats.hasWarnings()) {
        return
      }
      // Reload renderer if available
      if (this.nuxt.renderer) {
        this.nuxt.renderer.loadResources(mfs)
      }
    })

    // Add dev Middleware
    debug('Adding webpack middleware...')

    // Create webpack dev middleware
    this.webpackDevMiddleware = pify(webpackDevMiddleware(this.compiler.client, {
      publicPath: this.options.build.publicPath,
      stats: this.webpackStats,
      noInfo: true,
      quiet: true,
      watchOptions: this.options.watchers.webpack
    }))

    this.webpackHotMiddleware = pify(webpackHotMiddleware(this.compiler.client, {
      log: false,
      heartbeat: 2500
    }))

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
    const refreshFiles = _.debounce(this.generateRoutesAndFiles, 200)

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

const defaultsLoaders = [
  {
    test: /\.(png|jpe?g|gif|svg)$/,
    loader: 'url-loader',
    query: {
      limit: 1000, // 1KO
      name: 'img/[name].[hash:7].[ext]'
    }
  },
  {
    test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
    loader: 'url-loader',
    query: {
      limit: 1000, // 1 KO
      name: 'fonts/[name].[hash:7].[ext]'
    }
  }
]

const defaultsPostcss = [
  require('autoprefixer')({
    browsers: ['last 3 versions']
  })
]

const STATUS = {
  INITIAL: 1,
  BUILD_DONE: 2,
  BUILDING: 3
}
