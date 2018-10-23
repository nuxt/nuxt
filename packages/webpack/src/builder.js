import path from 'path'
import fs from 'fs'
import pify from 'pify'
import map from 'lodash/map'
import debounce from 'lodash/debounce'
import concat from 'lodash/concat'
import omit from 'lodash/omit'
import uniq from 'lodash/uniq'
import values from 'lodash/values'
import chokidar from 'chokidar'
import webpack from 'webpack'
import MFS from 'memory-fs'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import upath from 'upath'
import consola from 'consola'

import {
  r,
  parallel,
  sequence
} from '@nuxt/common'

import { ClientConfig, ServerConfig, PerfLoader } from './config'

export default class WebpackBuilder {
  constructor(context) {
    this.context = context
    this.nuxt = context.nuxt
    this.options = context.nuxt.options
    this.isStatic = context.isStatic
    this.plugins = context.plugins
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

    // Initialize shared FS and Cache
    if (this.options.dev) {
      this.mfs = new MFS()
    }
  }

  async build() {
    this.perfLoader = new PerfLoader(this.options)

    const compilersOptions = []

    // Client
    const clientConfig = new ClientConfig(this).config()
    compilersOptions.push(clientConfig)

    // Server
    let serverConfig = null
    if (this.options.build.ssr) {
      serverConfig = new ServerConfig(this).config()
      compilersOptions.push(serverConfig)
    }

    for (const p of this.plugins) {
      // Client config
      if (!clientConfig.resolve.alias[p.name]) {
        clientConfig.resolve.alias[p.name] = p.src
      }

      // Server config
      if (serverConfig && !serverConfig.resolve.alias[p.name]) {
        // Alias to noop for ssr:false plugins
        serverConfig.resolve.alias[p.name] = p.ssr ? p.src : './empty.js'
      }
    }

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
    patterns = map(patterns, upath.normalizeSafe)

    const options = this.options.watchers.chokidar
    /* istanbul ignore next */
    const refreshFiles = debounce(() => this.generateRoutesAndFiles(), 200)

    // Watch for src Files
    this.watchers.files = chokidar
      .watch(patterns, options)
      .on('add', refreshFiles)
      .on('unlink', refreshFiles)

    // Watch for custom provided files
    let customPatterns = concat(
      this.options.build.watch,
      ...values(omit(this.options.build.styleResources, ['options']))
    )
    customPatterns = map(uniq(customPatterns), upath.normalizeSafe)
    this.watchers.custom = chokidar
      .watch(customPatterns, options)
      .on('change', refreshFiles)
  }

  watchServer() {
    const nuxtRestartWatch = concat(
      this.options.serverMiddleware
        .filter(i => typeof i === 'string')
        .map(this.nuxt.resolver.resolveAlias),
      this.options.watch.map(this.nuxt.resolver.resolveAlias),
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

  forGenerate() {
    this.isStatic = true
  }
}
