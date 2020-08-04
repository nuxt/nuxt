import path from 'path'
import pify from 'pify'
import webpack from 'webpack'
import Glob from 'glob'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import consola from 'consola'

import { TARGETS, parallel, sequence, wrapArray, isModernRequest } from 'src/utils'
import { createMFS } from './utils/mfs'

import * as WebpackConfigs from './config'
import PerfLoader from './utils/perf-loader'

const glob = pify(Glob)

export class WebpackBundler {
  constructor (buildContext) {
    this.buildContext = buildContext

    // Class fields
    this.compilers = []
    this.compilersWatching = []
    this.devMiddleware = {}
    this.hotMiddleware = {}

    // Bind middleware to self
    this.middleware = this.middleware.bind(this)

    // Initialize shared MFS for dev
    if (this.buildContext.options.dev) {
      this.mfs = createMFS()
    }
  }

  getWebpackConfig (name) {
    const Config = WebpackConfigs[name.toLowerCase()] // eslint-disable-line import/namespace
    if (!Config) {
      throw new Error(`Unsupported webpack config ${name}`)
    }
    const config = new Config(this)
    return config.config()
  }

  async build () {
    const { options } = this.buildContext

    const webpackConfigs = [
      this.getWebpackConfig('Client')
    ]

    if (options.modern) {
      webpackConfigs.push(this.getWebpackConfig('Modern'))
    }

    if (options.build.ssr) {
      webpackConfigs.push(this.getWebpackConfig('Server'))
    }

    await this.buildContext.nuxt.callHook('webpack:config', webpackConfigs)

    // Check styleResource existence
    const { styleResources } = this.buildContext.options.build
    if (styleResources && Object.keys(styleResources).length) {
      consola.warn(
        'Using styleResources without the @nuxtjs/style-resources is not suggested and can lead to severe performance issues.',
        'Please use https://github.com/nuxt-community/style-resources-module'
      )
      for (const ext of Object.keys(styleResources)) {
        await Promise.all(wrapArray(styleResources[ext]).map(async (p) => {
          const styleResourceFiles = await glob(path.resolve(this.buildContext.options.rootDir, p))

          if (!styleResourceFiles || styleResourceFiles.length === 0) {
            throw new Error(`Style Resource not found: ${p}`)
          }
        }))
      }
    }

    // Configure compilers
    this.compilers = webpackConfigs.map((config) => {
      const compiler = webpack(config)

      // In dev, write files in memory FS
      if (options.dev) {
        compiler.outputFileSystem = this.mfs
      }

      return compiler
    })

    // Warm up perfLoader before build
    if (options.build.parallel) {
      consola.info('Warming up worker pools')
      PerfLoader.warmupAll({ dev: options.dev })
      consola.success('Worker pools ready')
    }

    // Start Builds
    const runner = options.dev ? parallel : sequence

    await runner(this.compilers, compiler => this.webpackCompile(compiler))
  }

  async webpackCompile (compiler) {
    const { name } = compiler.options
    const { nuxt, options } = this.buildContext

    await nuxt.callHook('build:compile', { name, compiler })

    // Load renderer resources after build
    compiler.hooks.done.tap('load-resources', async (stats) => {
      await nuxt.callHook('build:compiled', {
        name,
        compiler,
        stats
      })

      // Reload renderer
      await nuxt.callHook('build:resources', this.mfs)
    })

    // --- Dev Build ---
    if (options.dev) {
      // Client buiild
      if (['client', 'modern'].includes(name)) {
        return new Promise((resolve, reject) => {
          compiler.hooks.done.tap('nuxt-dev', () => { resolve() })
          compiler.hooks.failed.tap('nuxt-errorlog', (err) => { reject(err) })
          // Start watch
          this.webpackDev(compiler)
        })
      }

      // Server, build and watch for changes
      return new Promise((resolve, reject) => {
        const watching = compiler.watch(options.watchers.webpack, (err) => {
          if (err) {
            return reject(err)
          }
          resolve()
        })

        watching.close = pify(watching.close)
        this.compilersWatching.push(watching)
      })
    }

    // --- Production Build ---
    compiler.run = pify(compiler.run)
    const stats = await compiler.run()

    if (stats.hasErrors()) {
      // non-quiet mode: errors will be printed by webpack itself
      const error = new Error('Nuxt build error')
      if (options.build.quiet === true) {
        error.stack = stats.toString('errors-only')
      }
      throw error
    }

    // Await for renderer to load resources (programmatic, tests and generate)
    await nuxt.callHook('build:resources')
  }

  async webpackDev (compiler) {
    consola.debug('Creating webpack middleware...')

    const { name } = compiler.options
    const buildOptions = this.buildContext.options.build
    const { client, ...hotMiddlewareOptions } = buildOptions.hotMiddleware || {}

    // Create webpack dev middleware
    this.devMiddleware[name] = pify(
      webpackDevMiddleware(
        compiler, {
          publicPath: buildOptions.publicPath,
          stats: false,
          logLevel: 'silent',
          watchOptions: this.buildContext.options.watchers.webpack,
          fs: this.mfs,
          ...buildOptions.devMiddleware
        })
    )

    this.devMiddleware[name].close = pify(this.devMiddleware[name].close)

    this.compilersWatching.push(this.devMiddleware[name].context.watching)

    this.hotMiddleware[name] = pify(
      webpackHotMiddleware(
        compiler, {
          log: false,
          heartbeat: 10000,
          path: `/__webpack_hmr/${name}`,
          ...hotMiddlewareOptions
        })
    )

    // Register devMiddleware on server
    await this.buildContext.nuxt.callHook('server:devMiddleware', this.middleware)
  }

  async middleware (req, res, next) {
    const name = isModernRequest(req, this.buildContext.options.modern) ? 'modern' : 'client'

    if (this.devMiddleware && this.devMiddleware[name]) {
      await this.devMiddleware[name](req, res)
    }

    if (this.hotMiddleware && this.hotMiddleware[name]) {
      await this.hotMiddleware[name](req, res)
    }

    next()
  }

  async unwatch () {
    await Promise.all(this.compilersWatching.map(watching => watching.close()))
  }

  async close () {
    if (this.__closed) {
      return
    }
    this.__closed = true

    // Unwatch
    await this.unwatch()

    // Stop webpack middleware
    for (const devMiddleware of Object.values(this.devMiddleware)) {
      await devMiddleware.close()
    }

    for (const compiler of this.compilers) {
      compiler.close()
    }

    // Cleanup MFS
    if (this.mfs) {
      delete this.mfs.data
      delete this.mfs
    }

    // Cleanup more resources
    delete this.compilers
    delete this.compilersWatching
    delete this.devMiddleware
    delete this.hotMiddleware
  }

  forGenerate () {
    this.buildContext.target = TARGETS.static
  }
}
