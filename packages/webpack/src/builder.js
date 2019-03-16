import path from 'path'
import pify from 'pify'
import webpack from 'webpack'
import Glob from 'glob'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import consola from 'consola'

import {
  parallel,
  sequence,
  wrapArray
} from '@nuxt/utils'
import AsyncMFS from './utils/async-mfs'

import { ClientConfig, ModernConfig, ServerConfig } from './config'
import PerfLoader from './utils/perf-loader'

const glob = pify(Glob)

export class WebpackBundler {
  constructor(buildContext) {
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
      this.mfs = new AsyncMFS()
    }
  }

  async build() {
    const { options } = this.buildContext

    const compilersOptions = []

    // Client
    const clientConfig = new ClientConfig(this).config()
    compilersOptions.push(clientConfig)

    // Modern
    let modernConfig
    if (options.modern) {
      modernConfig = new ModernConfig(this).config()
      compilersOptions.push(modernConfig)
    }

    // Server
    let serverConfig = null
    if (options.build.ssr) {
      serverConfig = new ServerConfig(this).config()
      compilersOptions.push(serverConfig)
    }

    for (const p of this.buildContext.plugins) {
      // Client config
      if (!clientConfig.resolve.alias[p.name]) {
        clientConfig.resolve.alias[p.name] = p.mode === 'server' ? './empty.js' : p.src
      }

      // Modern config
      if (modernConfig && !modernConfig.resolve.alias[p.name]) {
        modernConfig.resolve.alias[p.name] = p.mode === 'server' ? './empty.js' : p.src
      }

      // Server config
      if (serverConfig && !serverConfig.resolve.alias[p.name]) {
        serverConfig.resolve.alias[p.name] = p.mode === 'client' ? './empty.js' : p.src
      }
    }

    // Check styleResource existence
    const { styleResources } = this.buildContext.options.build
    if (styleResources && Object.keys(styleResources).length) {
      consola.warn(
        'Using styleResources without the nuxt-style-resources-module is not suggested and can lead to severe performance issues.',
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
    this.compilers = compilersOptions.map((compilersOption) => {
      const compiler = webpack(compilersOption)

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

  async webpackCompile(compiler) {
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
      // Client Build, watch is started by dev-middleware
      if (['client', 'modern'].includes(name)) {
        return new Promise((resolve, reject) => {
          compiler.hooks.done.tap('nuxt-dev', () => resolve())
          return this.webpackDev(compiler)
        })
      }

      // Server, build and watch for changes
      return new Promise((resolve, reject) => {
        const watching = compiler.watch(options.watchers.webpack, (err) => {
          if (err) {
            return reject(err)
          }
          watching.close = pify(watching.close)
          this.compilersWatching.push(watching)
          resolve()
        })
      })
    }

    // --- Production Build ---
    compiler.run = pify(compiler.run)
    const stats = await compiler.run()

    if (stats.hasErrors()) {
      if (options.build.quiet === true) {
        return Promise.reject(stats.toString(options.build.stats))
      }

      // Actual error will be printed by webpack
      throw new Error('Nuxt Build Error')
    }
  }

  async webpackDev(compiler) {
    consola.debug('Creating webpack middleware...')

    const { name } = compiler.options
    const buildOptions = this.buildContext.options.build
    const { client, ...hotMiddlewareOptions } = buildOptions.hotMiddleware || {}

    // Create webpack dev middleware
    this.devMiddleware[name] = pify(
      webpackDevMiddleware(
        compiler,
        Object.assign(
          {
            publicPath: buildOptions.publicPath,
            stats: false,
            logLevel: 'silent',
            watchOptions: this.buildContext.options.watchers.webpack
          },
          buildOptions.devMiddleware
        )
      )
    )

    this.devMiddleware[name].close = pify(this.devMiddleware[name].close)

    this.hotMiddleware[name] = pify(
      webpackHotMiddleware(
        compiler,
        Object.assign(
          {
            log: false,
            heartbeat: 10000
          },
          hotMiddlewareOptions,
          {
            path: `/__webpack_hmr/${name}`
          }
        )
      )
    )

    // Register devMiddleware on server
    await this.buildContext.nuxt.callHook('server:devMiddleware', this.middleware)
  }

  async middleware(req, res, next) {
    const name = req.modernMode ? 'modern' : 'client'

    if (this.devMiddleware && this.devMiddleware[name]) {
      await this.devMiddleware[name](req, res)
    }

    if (this.hotMiddleware && this.hotMiddleware[name]) {
      await this.hotMiddleware[name](req, res)
    }

    next()
  }

  async unwatch() {
    await Promise.all(this.compilersWatching.map(watching => watching.close()))
  }

  async close() {
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

  forGenerate() {
    this.buildContext.isStatic = true
  }
}
