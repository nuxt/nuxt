import path from 'path'
import pify from 'pify'
import webpack from 'webpack'
import MFS from 'memory-fs'
import Glob from 'glob'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import consola from 'consola'

import {
  parallel,
  sequence,
  wrapArray
} from '@nuxt/common'

import { ClientConfig, ModernConfig, ServerConfig } from './config'
import PerfLoader from './utils/perf-loader'

const glob = pify(Glob)

export class WebpackBundler {
  constructor(context) {
    this.context = context
    // Fields that set on build
    this.compilers = []
    this.compilersWatching = []
    this.devMiddleware = {}
    this.hotMiddleware = {}

    // Initialize shared MFS for dev
    if (this.context.options.dev) {
      this.mfs = new MFS()

      // TODO: Enable when async FS rquired
      // this.mfs.exists = function (...args) { return Promise.resolve(this.existsSync(...args)) }
      // this.mfs.readFile = function (...args) { return Promise.resolve(this.readFileSync(...args)) }
    }
  }

  async build() {
    const options = this.context.options

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

    for (const p of this.context.plugins) {
      // Client config
      if (!clientConfig.resolve.alias[p.name]) {
        clientConfig.resolve.alias[p.name] = p.src
      }

      // Server config
      if (serverConfig && !serverConfig.resolve.alias[p.name]) {
        // Alias to noop for ssr:false plugins
        serverConfig.resolve.alias[p.name] = p.ssr ? p.src : './empty.js'
      }

      // Modern config
      if (modernConfig && !modernConfig.resolve.alias[p.name]) {
        modernConfig.resolve.alias[p.name] = p.src
      }
    }

    // Check styleResource existence
    const styleResources = this.context.options.build.styleResources
    if (styleResources && Object.keys(styleResources).length) {
      consola.warn(
        'Using styleResources without the nuxt-style-resources-module is not suggested and can lead to severe performance issues.',
        'Please use https://github.com/nuxt-community/style-resources-module'
      )
    }
    for (const ext of Object.keys(styleResources)) {
      await Promise.all(wrapArray(styleResources[ext]).map(async (p) => {
        const styleResourceFiles = await glob(path.resolve(this.context.options.rootDir, p))

        if (!styleResourceFiles || styleResourceFiles.length === 0) {
          throw new Error(`Style Resource not found: ${p}`)
        }
      }))
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

    // Warmup perfLoader before build
    if (options.build.parallel) {
      consola.info('Warming up worker pools')
      PerfLoader.warmupAll({ dev: options.dev })
      consola.success('Worker pools ready')
    }

    // Start Builds
    const runner = options.dev ? parallel : sequence

    await runner(this.compilers, (compiler) => {
      return this.webpackCompile(compiler)
    })
  }

  async webpackCompile(compiler) {
    const name = compiler.options.name
    const { nuxt, options } = this.context

    await nuxt.callHook('build:compile', { name, compiler })

    // Load renderer resources after build
    compiler.hooks.done.tap('load-resources', async (stats) => {
      await nuxt.callHook('build:compiled', {
        name,
        compiler,
        stats
      })

      // Reload renderer if available
      await nuxt.callHook('build:resources', this.mfs)
    })

    // --- Dev Build ---
    if (options.dev) {
      // Client Build, watch is started by dev-middleware
      if (['client', 'modern'].includes(name)) {
        this.webpackDev(compiler)
        return new Promise((resolve, reject) => {
          compiler.hooks.done.tap('nuxt-dev', stats => stats.hasErrors() ? reject(stats) : resolve())
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
      } else {
        // Actual error will be printet by webpack
        throw new Error('Nuxt Build Error')
      }
    }
  }

  webpackDev(compiler) {
    consola.debug('Adding webpack middleware...')

    const name = [compiler.options.name]
    const { nuxt: { server }, options } = this.context

    // Create webpack dev middleware
    this.devMiddleware[name] = pify(
      webpackDevMiddleware(
        compiler,
        Object.assign(
          {
            publicPath: options.build.publicPath,
            stats: false,
            logLevel: 'silent',
            watchOptions: options.watchers.webpack
          },
          options.build.devMiddleware
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
          options.build.hotMiddleware,
          {
            path: `/__webpack_hmr/${name}`
          }
        )
      )
    )

    // Inject to renderer instance
    if (server) {
      server.devMiddleware = this.devMiddleware
      server.hotMiddleware = this.hotMiddleware
    }
  }

  async unwatch() {
    for (const watching of this.compilersWatching) {
      await watching.close()
    }
  }

  async close() {
    // Unwatch
    await this.unwatch()

    // Stop webpack middleware
    for (const devMiddleware of Object.values(this.devMiddleware)) {
      await devMiddleware.close()
    }
  }

  forGenerate() {
    this.context.isStatic = true
  }
}
