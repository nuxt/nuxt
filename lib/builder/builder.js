import path from 'path'
import fs from 'fs'

import pify from 'pify'
import _ from 'lodash'
import chokidar from 'chokidar'
import fsExtra from 'fs-extra'
import hash from 'hash-sum'
import webpack from 'webpack'
import serialize from 'serialize-javascript'
import MFS from 'memory-fs'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import Glob from 'glob'
import upath from 'upath'
import consola from 'consola'

import { r, wp, wChunk, createRoutes, parallel, sequence, relativeTo, waitFor } from '../common/utils'
import Options from '../common/options'

import PerfLoader from './webpack/utils/perf-loader'
import ClientWebpackConfig from './webpack/client'
import ServerWebpackConfig from './webpack/server'

const glob = pify(Glob)

export default class Builder {
  constructor(nuxt) {
    this.nuxt = nuxt
    this.isStatic = false // Flag to know if the build is for a generated app
    this.options = nuxt.options

    // Fields that set on build
    this.compilers = []
    this.compilersWatching = []
    this.webpackDevMiddleware = null
    this.webpackHotMiddleware = null
    this.watchers = {
      files: null,
      custom: null,
      restart: null
    }
    this.perfLoader = null

    // Helper to resolve build paths
    this.relativeToBuild = (...args) =>
      relativeTo(this.options.buildDir, ...args)

    this._buildStatus = STATUS.INITIAL

    // Stop watching on nuxt.close()
    if (this.options.dev) {
      this.nuxt.hook('close', () => this.unwatch())
    }

    // Initialize shared FS and Cache
    if (this.options.dev) {
      this.mfs = new MFS()
    }

    // if(!this.options.dev) {
    // TODO: enable again when unsafe concern resolved.(common/options.js:42)
    // this.nuxt.hook('build:done', () => this.generateConfig())
    // }
  }

  normalizePlugins() {
    return _.uniqBy(
      this.options.plugins.map((p) => {
        if (typeof p === 'string') p = { src: p }
        const pluginBaseName = path.basename(p.src, path.extname(p.src)).replace(
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

    consola.info({
      message: 'Building project',
      badge: true,
      clear: !this.options.dev
    })

    // Wait for nuxt ready
    await this.nuxt.ready()

    // Call before hook
    await this.nuxt.callHook('build:before', this, this.options.build)

    // Check if pages dir exists and warn if not
    this._nuxtPages = typeof this.options.build.createRoutes !== 'function'
    if (this._nuxtPages) {
      if (!fsExtra.existsSync(path.join(this.options.srcDir, this.options.dir.pages))) {
        const dir = this.options.srcDir
        if (fsExtra.existsSync(path.join(this.options.srcDir, '..', this.options.dir.pages))) {
          throw new Error(
            `No \`${this.options.dir.pages}\` directory found in ${dir}. Did you mean to run \`nuxt\` in the parent (\`../\`) directory?`
          )
        } else {
          this._defaultPage = true
        }
      }
    }

    consola.success('Builder initialized')

    consola.debug(`App root: ${this.options.srcDir}`)

    // Create .nuxt/, .nuxt/components and .nuxt/dist folders
    await fsExtra.remove(r(this.options.buildDir))
    const buildDirs = [r(this.options.buildDir, 'components')]
    if (!this.options.dev) {
      buildDirs.push(
        r(this.options.buildDir, 'dist', 'client'),
        r(this.options.buildDir, 'dist', 'server')
      )
    }
    await Promise.all(buildDirs.map(dir => fsExtra.mkdirp(dir)))

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

  async generateRoutesAndFiles() {
    consola.debug(`Generating nuxt files`)

    this.plugins = this.normalizePlugins()

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
      splitChunks: this.options.build.splitChunks,
      uniqBy: _.uniqBy,
      isDev: this.options.dev,
      debug: this.options.debug,
      vue: { config: this.options.vue.config },
      mode: this.options.mode,
      router: this.options.router,
      env: this.options.env,
      head: this.options.head,
      middleware: fsExtra.existsSync(path.join(this.options.srcDir, this.options.dir.middleware)),
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
    if (fsExtra.existsSync(path.resolve(this.options.srcDir, this.options.dir.layouts))) {
      const layoutsFiles = await glob(`${this.options.dir.layouts}/**/*.{vue,js}`, {
        cwd: this.options.srcDir,
        ignore: this.options.ignore
      })
      layoutsFiles.forEach((file) => {
        const name = file
          .split('/')
          .slice(1)
          .join('/')
          .replace(/\.(vue|js)$/, '')
        if (name === 'error') {
          if (!templateVars.components.ErrorPage) {
            templateVars.components.ErrorPage = this.relativeToBuild(
              this.options.srcDir,
              file
            )
          }
          return
        }
        if (!templateVars.layouts[name] || /\.vue$/.test(file)) {
          templateVars.layouts[name] = this.relativeToBuild(
            this.options.srcDir,
            file
          )
        }
      })
    }
    // If no default layout, create its folder and add the default folder
    if (!templateVars.layouts.default) {
      await fsExtra.mkdirp(r(this.options.buildDir, 'layouts'))
      templatesFiles.push('layouts/default.vue')
      templateVars.layouts.default = './layouts/default.vue'
    }

    // -- Routes --
    consola.debug('Generating routes...')

    if (this._defaultPage) {
      templateVars.router.routes = createRoutes(
        ['index.vue'],
        this.options.nuxtAppDir + '/pages'
      )
    } else if (this._nuxtPages) { // If user defined a custom method to create routes
      // Use nuxt.js createRoutes bases on pages/
      const files = {}
      ;(await glob(`${this.options.dir.pages}/**/*.{vue,js}`, {
        cwd: this.options.srcDir,
        ignore: this.options.ignore
      })).forEach((f) => {
        const key = f.replace(/\.(js|vue)$/, '')
        if (/\.vue$/.test(f) || !files[key]) {
          files[key] = f.replace(/('|")/g, '\\$1')
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
      t => t.dst || path.basename(t.src || t)
    )

    templatesFiles = templatesFiles
      .map((file) => {
        // Skip if custom file was already provided in build.templates[]
        if (customTemplateFiles.indexOf(file) !== -1) {
          return
        }
        // Allow override templates using a file with same name in ${srcDir}/app
        const customPath = r(this.options.srcDir, 'app', file)
        const customFileExists = fsExtra.existsSync(customPath)

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
      this.options.build.templates.map((t) => {
        return Object.assign(
          {
            src: r(this.options.srcDir, t.src || t),
            dst: t.dst || path.basename(t.src || t),
            custom: true
          },
          t
        )
      })
    )

    // -- Loading indicator --
    if (this.options.loadingIndicator.name) {
      const indicatorPath1 = path.resolve(
        this.options.nuxtAppDir,
        'views/loading',
        this.options.loadingIndicator.name + '.html'
      )
      const indicatorPath2 = this.nuxt.resolveAlias(
        this.options.loadingIndicator.name
      )
      const indicatorPath = fsExtra.existsSync(indicatorPath1)
        ? indicatorPath1
        : fsExtra.existsSync(indicatorPath2) ? indicatorPath2 : null
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
        const fileContent = await fsExtra.readFile(src, 'utf8')
        let content
        try {
          const template = _.template(fileContent, {
            imports: {
              serialize,
              hash,
              r,
              wp,
              wChunk,
              resolvePath: this.nuxt.resolvePath,
              resolveAlias: this.nuxt.resolveAlias,
              relativeToBuild: this.relativeToBuild
            },
            interpolate: /<%=([\s\S]+?)%>/g
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
        const _path = r(this.options.buildDir, dst)
        // Ensure parent dir exits and write file
        await fsExtra.outputFile(_path, content, 'utf8')
      })
    )

    consola.success('Nuxt files generated')
  }

  async webpackBuild() {
    this.perfLoader = new PerfLoader(this.options)

    const compilersOptions = []

    // Client
    const clientConfig = new ClientWebpackConfig(this).config()
    compilersOptions.push(clientConfig)

    // Server
    let serverConfig = null
    if (this.options.build.ssr) {
      serverConfig = new ServerWebpackConfig(this).config()
      compilersOptions.push(serverConfig)
    }

    // Check plugins exist then set alias to their real path
    await Promise.all(this.plugins.map(async (p) => {
      const ext = path.extname(p.src) ? '' : '{.+([^.]),/index.+([^.])}'
      const pluginFiles = await glob(`${p.src}${ext}`)

      if (!pluginFiles || pluginFiles.length === 0) {
        throw new Error(`Plugin not found: ${p.src}`)
      } else if (pluginFiles.length > 1) {
        consola.warn({
          message: `Found ${pluginFiles.length} plugins that match the configuration, suggest to specify extension:`,
          additional: `  ${pluginFiles.join('\n  ')}`,
          badge: true
        })
      }

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
    }))

    // Configure compilers
    this.compilers = compilersOptions.map((compilersOption) => {
      const compiler = webpack(compilersOption)

      // In dev, write files in memory FS
      if (this.options.dev) {
        compiler.outputFileSystem = this.mfs
      }

      return compiler
    })

    // Warmup perfLoader before build
    if (this.options.build.parallel) {
      consola.info('Warming up worker pools')
      this.perfLoader.warmupAll()
      consola.success('Worker pools ready')
    }

    // Start Builds
    const runner = this.options.dev ? parallel : sequence

    await runner(this.compilers, (compiler) => {
      return this.webpackCompile(compiler)
    })
  }

  webpackCompile(compiler) {
    return new Promise(async (resolve, reject) => {
      const name = compiler.options.name

      await this.nuxt.callHook('build:compile', { name, compiler })

      // Load renderer resources after build
      compiler.hooks.done.tap('load-resources', async (stats) => {
        await this.nuxt.callHook('build:compiled', {
          name,
          compiler,
          stats
        })

        // Reload renderer if available
        this.nuxt.renderer.loadResources(this.mfs || fs)

        // Resolve on next tick
        process.nextTick(resolve)
      })

      if (this.options.dev) {
        // --- Dev Build ---
        // Client Build, watch is started by dev-middleware
        if (compiler.options.name === 'client') {
          return this.webpackDev(compiler)
        }
        // Server, build and watch for changes
        this.compilersWatching.push(
          compiler.watch(this.options.watchers.webpack, (err) => {
            /* istanbul ignore if */
            if (err) return reject(err)
          })
        )
      } else {
        // --- Production Build ---
        compiler.run((err, stats) => {
          /* istanbul ignore next */
          if (err) {
            return reject(err)
          } else if (stats.hasErrors()) {
            if (this.options.build.quiet === true) {
              err = stats.toString(this.options.build.stats)
            }
            if (!err) {
              // actual errors will be printed by webpack itself
              err = 'Nuxt Build Error'
            }

            return reject(err)
          }

          resolve()
        })
      }
    })
  }

  webpackDev(compiler) {
    consola.debug('Adding webpack middleware...')

    // Create webpack dev middleware
    this.webpackDevMiddleware = pify(
      webpackDevMiddleware(
        compiler,
        Object.assign(
          {
            publicPath: this.options.build.publicPath,
            stats: false,
            logLevel: 'silent',
            watchOptions: this.options.watchers.webpack
          },
          this.options.build.devMiddleware
        )
      )
    )

    this.webpackDevMiddleware.close = pify(this.webpackDevMiddleware.close)

    this.webpackHotMiddleware = pify(
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

    // Start watching client files
    this.watchClient()
  }

  watchClient() {
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
    patterns = _.map(patterns, upath.normalizeSafe)

    const options = this.options.watchers.chokidar
    /* istanbul ignore next */
    const refreshFiles = _.debounce(() => this.generateRoutesAndFiles(), 200)

    // Watch for src Files
    this.watchers.files = chokidar
      .watch(patterns, options)
      .on('add', refreshFiles)
      .on('unlink', refreshFiles)

    // Watch for custom provided files
    let customPatterns = _.concat(
      this.options.build.watch,
      ..._.values(_.omit(this.options.build.styleResources, ['options']))
    )
    customPatterns = _.map(_.uniq(customPatterns), upath.normalizeSafe)
    this.watchers.custom = chokidar
      .watch(customPatterns, options)
      .on('change', refreshFiles)
  }

  watchServer() {
    const nuxtRestartWatch = _.concat(
      this.options.serverMiddleware
        .filter(i => typeof i === 'string')
        .map(this.nuxt.resolveAlias),
      this.options.watch.map(this.nuxt.resolveAlias),
      path.join(this.options.rootDir, 'nuxt.config.js')
    )

    this.watchers.restart = chokidar
      .watch(nuxtRestartWatch, this.options.watchers.chokidar)
      .on('change', (_path) => {
        this.watchers.restart.close()
        const { name, ext } = path.parse(_path)
        this.nuxt.callHook('watch:fileChanged', this, `${name}${ext}`)
      })
  }

  async unwatch() {
    for (const watcher in this.watchers) {
      if (this.watchers[watcher]) {
        this.watchers[watcher].close()
      }
    }

    this.compilersWatching.forEach(watching => watching.close())

    // Stop webpack middleware
    if (this.webpackDevMiddleware) {
      await this.webpackDevMiddleware.close()
    }
  }

  // TODO: remove ignore when generateConfig enabled again
  async generateConfig() /* istanbul ignore next */ {
    const config = path.resolve(this.options.buildDir, 'build.config.js')
    const options = _.omit(this.options, Options.unsafeKeys)
    await fsExtra.writeFile(
      config,
      `export default ${JSON.stringify(options, null, '  ')}`,
      'utf8'
    )
  }
}

const STATUS = {
  INITIAL: 1,
  BUILD_DONE: 2,
  BUILDING: 3
}
