const { promisify } = require('util')
const _ = require('lodash')
const chokidar = require('chokidar')
const { remove, readFile, writeFile, mkdirp, existsSync } = require('fs-extra')
const hash = require('hash-sum')
const webpack = require('webpack')
const serialize = require('serialize-javascript')
const { join, resolve, basename, extname, dirname } = require('path')
const MFS = require('memory-fs')
const webpackDevMiddleware = require('webpack-dev-middleware')
const webpackHotMiddleware = require('webpack-hot-middleware')
const Debug = require('debug')
const Glob = require('glob')
const {
  r,
  wp,
  wChunk,
  createRoutes,
  sequence,
  relativeTo,
  waitFor
} = require('../common/utils')
const { Options } = require('../common')
const clientWebpackConfig = require('./webpack/client.config.js')
const serverWebpackConfig = require('./webpack/server.config.js')
const dllWebpackConfig = require('./webpack/dll.config.js')
const upath = require('upath')

const debug = Debug('nuxt:build')
debug.color = 2 // Force green color

const glob = promisify(Glob)

module.exports = class Builder {
  constructor(nuxt) {
    this.nuxt = nuxt
    this.isStatic = false // Flag to know if the build is for a generated app
    this.options = nuxt.options

    // Fields that set on build
    this.compilers = []
    this.compilersWatching = []
    this.webpackDevMiddleware = null
    this.webpackHotMiddleware = null
    this.filesWatcher = null
    this.customFilesWatcher = null

    // Mute stats on dev
    this.webpackStats = this.options.dev ? false : this.options.build.stats

    // Helper to resolve build paths
    this.relativeToBuild = (...args) =>
      relativeTo(this.options.buildDir, ...args)

    this._buildStatus = STATUS.INITIAL

    // Stop watching on nuxt.close()
    if (this.options.dev) {
      this.nuxt.hook('close', () => this.unwatch())
    }
    // else {
    // TODO: enable again when unsafe concern resolved.(common/options.js:42)
    // this.nuxt.hook('build:done', () => this.generateConfig())
    // }
  }

  get plugins() {
    return _.uniqBy(
      this.options.plugins.map((p, i) => {
        if (typeof p === 'string') p = { src: p }
        const pluginBaseName = basename(p.src, extname(p.src)).replace(
          /[^a-zA-Z?\d\s:]/g,
          ''
        )
        return {
          src: this.nuxt.resolveAlias(p.src),
          ssr: p.ssr !== false,
          name: 'nuxt_plugin_' + pluginBaseName + '_' + hash(p.src)
        }
      }),
      p => p.name
    )
  }

  vendor() {
    return ['vue', 'vue-router', 'vue-meta', this.options.store && 'vuex']
      .concat(
        this.options.build.extractCSS && [
          // https://github.com/webpack-contrib/extract-text-webpack-plugin/issues/456
          'vue-style-loader/lib/addStylesClient',
          'css-loader/lib/css-base'
        ]
      )
      .concat(this.options.build.vendor)
      .filter(v => v)
  }

  vendorEntries() {
    // Used for dll
    const vendor = this.vendor()
    const vendorEntries = {}
    vendor.forEach(v => {
      try {
        require.resolve(v)
        vendorEntries[v] = [v]
      } catch (e) {
        // Ignore
      }
    })
    return vendorEntries
  }

  forGenerate() {
    this.isStatic = true
  }

  async build() {
    // Avoid calling build() method multiple times when dev:true
    /* istanbul ignore if */
    if (this._buildStatus === STATUS.BUILD_DONE && this.options.dev) {
      return this
    }
    // If building
    /* istanbul ignore if */
    if (this._buildStatus === STATUS.BUILDING) {
      await waitFor(1000)
      return this.build()
    }
    this._buildStatus = STATUS.BUILDING

    // Wait for nuxt ready
    await this.nuxt.ready()

    // Call before hook
    await this.nuxt.callHook('build:before', this, this.options.build)

    // Check if pages dir exists and warn if not
    this._nuxtPages = typeof this.options.build.createRoutes !== 'function'
    if (this._nuxtPages) {
      if (!existsSync(join(this.options.srcDir, this.options.dir.pages))) {
        let dir = this.options.srcDir
        if (existsSync(join(this.options.srcDir, '..', this.options.dir.pages))) {
          throw new Error(
            `No \`${this.options.dir.pages}\` directory found in ${dir}. Did you mean to run \`nuxt\` in the parent (\`../\`) directory?`
          )
        } else {
          throw new Error(
            `Couldn't find a \`${this.options.dir.pages}\` directory in ${dir}. Please create one under the project root`
          )
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

    // Call done hook
    await this.nuxt.callHook('build:done', this)

    return this
  }

  getBabelOptions({ isServer }) {
    const options = _.defaults(
      {},
      {
        babelrc: false,
        cacheDirectory: !!this.options.dev
      },
      this.options.build.babel
    )

    if (typeof options.presets === 'function') {
      options.presets = options.presets({ isServer })
    }

    if (!options.babelrc && !options.presets) {
      options.presets = [
        [
          require.resolve('babel-preset-vue-app'),
          {
            targets: isServer ? { node: '8.0.0' } : { ie: 9, uglify: true }
          }
        ]
      ]
    }

    return options
  }

  getFileName(name) {
    let fileName = this.options.build.filenames[name]

    // Don't use hashes when watching
    // https://github.com/webpack/webpack/issues/1914#issuecomment-174171709
    if (this.options.dev) {
      fileName = fileName.replace(/\[(chunkhash|contenthash|hash)\]\./g, '')
    }

    return fileName
  }

  async generateRoutesAndFiles() {
    debug('Generating files...')
    // -- Templates --
    let templatesFiles = [
      'App.js',
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
      'components/nuxt.js',
      'components/no-ssr.js',
      'views/app.template.html',
      'views/error.html'
    ]
    const templateVars = {
      options: this.options,
      extensions: this.options.extensions
        .map(ext => ext.replace(/^\./, ''))
        .join('|'),
      messages: this.options.messages,
      uniqBy: _.uniqBy,
      isDev: this.options.dev,
      debug: this.options.debug,
      mode: this.options.mode,
      router: this.options.router,
      env: this.options.env,
      head: this.options.head,
      middleware: existsSync(join(this.options.srcDir, this.options.dir.middleware)),
      store: this.options.store,
      css: this.options.css,
      plugins: this.plugins,
      appPath: './App.js',
      ignorePrefix: this.options.ignorePrefix,
      layouts: Object.assign({}, this.options.layouts),
      loading:
        typeof this.options.loading === 'string'
          ? this.relativeToBuild(this.options.srcDir, this.options.loading)
          : this.options.loading,
      transition: this.options.transition,
      layoutTransition: this.options.layoutTransition,
      dir: this.options.dir,
      components: {
        ErrorPage: this.options.ErrorPage
          ? this.relativeToBuild(this.options.ErrorPage)
          : null
      }
    }

    // -- Layouts --
    if (existsSync(resolve(this.options.srcDir, this.options.dir.layouts))) {
      const layoutsFiles = await glob(`${this.options.dir.layouts}/**/*.{vue,js}`, {
        cwd: this.options.srcDir,
        ignore: this.options.ignore
      })
      let hasErrorLayout = false
      layoutsFiles.forEach(file => {
        let name = file
          .split('/')
          .slice(1)
          .join('/')
          .replace(/\.(vue|js)$/, '')
        if (name === 'error') {
          hasErrorLayout = true
          return
        }
        if (!templateVars.layouts[name] || /\.vue$/.test(file)) {
          templateVars.layouts[name] = this.relativeToBuild(
            this.options.srcDir,
            file
          )
        }
      })
      if (!templateVars.components.ErrorPage && hasErrorLayout) {
        templateVars.components.ErrorPage = this.relativeToBuild(
          this.options.srcDir,
          `${this.options.dir.layouts}/error.vue`
        )
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
      const files = {}
      ;(await glob(`${this.options.dir.pages}/**/*.{vue,js}`, {
        cwd: this.options.srcDir,
        ignore: this.options.ignore
      })).forEach(f => {
        const key = f.replace(/\.(js|vue)$/, '')
        if (/\.vue$/.test(f) || !files[key]) {
          files[key] = f
        }
      })
      templateVars.router.routes = createRoutes(
        Object.values(files),
        this.options.srcDir,
        this.options.dir.pages
      )
    } else {
      templateVars.router.routes = this.options.build.createRoutes(
        this.options.srcDir
      )
    }

    await this.nuxt.callHook(
      'build:extendRoutes',
      templateVars.router.routes,
      r
    )

    // router.extendRoutes method
    if (typeof this.options.router.extendRoutes === 'function') {
      // let the user extend the routes
      const extendedRoutes = this.options.router.extendRoutes(
        templateVars.router.routes,
        r
      )
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
    const customTemplateFiles = this.options.build.templates.map(
      t => t.dst || basename(t.src || t)
    )

    templatesFiles = templatesFiles
      .map(file => {
        // Skip if custom file was already provided in build.templates[]
        if (customTemplateFiles.indexOf(file) !== -1) {
          return
        }
        // Allow override templates using a file with same name in ${srcDir}/app
        const customPath = r(this.options.srcDir, 'app', file)
        const customFileExists = existsSync(customPath)

        return {
          src: customFileExists ? customPath : r(this.options.nuxtAppDir, file),
          dst: file,
          custom: customFileExists
        }
      })
      .filter(i => !!i)

    // -- Custom templates --
    // Add custom template files
    templatesFiles = templatesFiles.concat(
      this.options.build.templates.map(t => {
        return Object.assign(
          {
            src: r(this.options.srcDir, t.src || t),
            dst: t.dst || basename(t.src || t),
            custom: true
          },
          t
        )
      })
    )

    // -- Loading indicator --
    if (this.options.loadingIndicator.name) {
      const indicatorPath1 = resolve(
        this.options.nuxtAppDir,
        'views/loading',
        this.options.loadingIndicator.name + '.html'
      )
      const indicatorPath2 = this.nuxt.resolveAlias(
        this.options.loadingIndicator.name
      )
      const indicatorPath = existsSync(indicatorPath1)
        ? indicatorPath1
        : existsSync(indicatorPath2) ? indicatorPath2 : null
      if (indicatorPath) {
        templatesFiles.push({
          src: indicatorPath,
          dst: 'loading.html',
          options: this.options.loadingIndicator
        })
      } else {
        /* istanbul ignore next */
        // eslint-disable-next-line no-console
        console.error(
          `Could not fetch loading indicator: ${
            this.options.loadingIndicator.name
          }`
        )
      }
    }

    await this.nuxt.callHook('build:templates', {
      templatesFiles,
      templateVars,
      resolve: r
    })

    // Interpret and move template files to .nuxt/
    await Promise.all(
      templatesFiles.map(async ({ src, dst, options, custom }) => {
        // Add template to watchers
        this.options.build.watch.push(src)
        // Render template to dst
        const fileContent = await readFile(src, 'utf8')
        let content
        try {
          const template = _.template(fileContent, {
            imports: {
              serialize,
              hash,
              r,
              wp,
              wChunk,
              resolvePath: this.nuxt.resolvePath.bind(this.nuxt),
              resolveAlias: this.nuxt.resolveAlias.bind(this.nuxt),
              relativeToBuild: this.relativeToBuild
            }
          })
          content = template(
            Object.assign({}, templateVars, {
              options: options || {},
              custom,
              src,
              dst
            })
          )
        } catch (err) {
          /* istanbul ignore next */
          throw new Error(`Could not compile template ${src}: ${err.message}`)
        }
        const path = r(this.options.buildDir, dst)
        // Ensure parent dir exits
        await mkdirp(dirname(path))
        // Write file
        await writeFile(path, content, 'utf8')
      })
    )
  }

  async webpackBuild() {
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

    // Make a dll plugin after compile to make nuxt dev builds faster
    if (this.options.build.dll && this.options.dev) {
      compilersOptions.push(dllWebpackConfig.call(this, clientConfig))
    }

    // Initialize shared FS and Cache
    const sharedFS = this.options.dev && new MFS()
    const sharedCache = {}

    // Initialize compilers
    this.compilers = compilersOptions.map(compilersOption => {
      const compiler = webpack(compilersOption)
      // In dev, write files in memory FS (except for DLL)
      if (sharedFS && !compiler.name.includes('-dll')) {
        compiler.outputFileSystem = sharedFS
      }
      compiler.cache = sharedCache
      return compiler
    })

    // Start Builds
    await sequence(
      this.compilers,
      compiler =>
        new Promise(async (resolve, reject) => {
          const name = compiler.options.name
          await this.nuxt.callHook('build:compile', { name, compiler })

          // Resolve only when compiler emit done event
          compiler.plugin('done', async stats => {
            await this.nuxt.callHook('build:compiled', {
              name,
              compiler,
              stats
            })
            // Reload renderer if available
            this.nuxt.renderer.loadResources(sharedFS || require('fs'))
            // Resolve on next tick
            process.nextTick(resolve)
          })
          // --- Dev Build ---
          if (this.options.dev) {
            // Client Build, watch is started by dev-middleware
            if (compiler.options.name === 'client') {
              return this.webpackDev(compiler)
            }
            // DLL build, should run only once
            if (compiler.options.name.includes('-dll')) {
              compiler.run((err, stats) => {
                if (err) return reject(err)
                debug('[DLL] updated')
              })
              return
            }
            // Server, build and watch for changes
            this.compilersWatching.push(
              compiler.watch(this.options.watchers.webpack, err => {
                /* istanbul ignore if */
                if (err) return reject(err)
              })
            )
            return
          }
          // --- Production Build ---
          compiler.run((err, stats) => {
            /* istanbul ignore if */
            if (err) {
              console.error(err) // eslint-disable-line no-console
              return reject(err)
            }

            // Show build stats for production
            console.log(stats.toString(this.webpackStats)) // eslint-disable-line no-console

            /* istanbul ignore if */
            if (stats.hasErrors()) {
              return reject(new Error('Webpack build exited with errors'))
            }
          })
        })
    )
  }

  webpackDev(compiler) {
    debug('Adding webpack middleware...')

    // Create webpack dev middleware
    this.webpackDevMiddleware = promisify(
      webpackDevMiddleware(
        compiler,
        Object.assign(
          {
            publicPath: this.options.build.publicPath,
            stats: this.webpackStats,
            logLevel: 'silent',
            watchOptions: this.options.watchers.webpack
          },
          this.options.build.devMiddleware
        )
      )
    )

    this.webpackDevMiddleware.close = promisify(this.webpackDevMiddleware.close)

    this.webpackHotMiddleware = promisify(
      webpackHotMiddleware(
        compiler,
        Object.assign(
          {
            log: false,
            heartbeat: 10000
          },
          this.options.build.hotMiddleware
        )
      )
    )

    // Inject to renderer instance
    if (this.nuxt.renderer) {
      this.nuxt.renderer.webpackDevMiddleware = this.webpackDevMiddleware
      this.nuxt.renderer.webpackHotMiddleware = this.webpackHotMiddleware
    }

    // Start watching files
    this.watchFiles()
  }

  watchFiles() {
    const src = this.options.srcDir
    let patterns = [
      r(src, this.options.dir.layouts),
      r(src, this.options.dir.store),
      r(src, this.options.dir.middleware),
      r(src, `${this.options.dir.layouts}/*.{vue,js}`),
      r(src, `${this.options.dir.layouts}/**/*.{vue,js}`)
    ]
    if (this._nuxtPages) {
      patterns.push(
        r(src, this.options.dir.pages),
        r(src, `${this.options.dir.pages}/*.{vue,js}`),
        r(src, `${this.options.dir.pages}/**/*.{vue,js}`)
      )
    }
    patterns = _.map(patterns, p => upath.normalizeSafe(p))

    const options = Object.assign({}, this.options.watchers.chokidar, {
      ignoreInitial: true
    })
    /* istanbul ignore next */
    const refreshFiles = _.debounce(() => this.generateRoutesAndFiles(), 200)

    // Watch for src Files
    this.filesWatcher = chokidar
      .watch(patterns, options)
      .on('add', refreshFiles)
      .on('unlink', refreshFiles)

    // Watch for custom provided files
    let customPatterns = _.concat(
      this.options.build.watch,
      ..._.values(_.omit(this.options.build.styleResources, ['options']))
    )
    customPatterns = _.map(_.uniq(customPatterns), p =>
      upath.normalizeSafe(p)
    )
    this.customFilesWatcher = chokidar
      .watch(customPatterns, options)
      .on('change', refreshFiles)
  }

  async unwatch() {
    if (this.filesWatcher) {
      this.filesWatcher.close()
    }

    if (this.customFilesWatcher) {
      this.customFilesWatcher.close()
    }

    this.compilersWatching.forEach(watching => watching.close())

    // Stop webpack middleware
    await this.webpackDevMiddleware.close()
  }

  // TODO: remove ignore when generateConfig enabled again
  async generateConfig() /* istanbul ignore next */ {
    const config = resolve(this.options.buildDir, 'build.config.js')
    const options = _.omit(this.options, Options.unsafeKeys)
    await writeFile(
      config,
      `module.exports = ${JSON.stringify(options, null, '  ')}`,
      'utf8'
    )
  }
}

const STATUS = {
  INITIAL: 1,
  BUILD_DONE: 2,
  BUILDING: 3
}
