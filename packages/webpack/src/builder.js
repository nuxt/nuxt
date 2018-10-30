import fs from 'fs'
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

import { ClientConfig, ModernConfig, ServerConfig, PerfLoader } from './config'

const glob = pify(Glob)

export class WebpackBuilder {
  constructor(context) {
    this.context = context
    // Fields that set on build
    this.compilers = []
    this.compilersWatching = []
    this.webpackDevMiddleware = null
    this.webpackHotMiddleware = null
    this.perfLoader = null

    // Initialize shared FS and Cache
    if (this.context.options.dev) {
      this.mfs = new MFS()
    }
  }

  async build() {
    const options = this.context.options

    this.perfLoader = new PerfLoader(options)

    const compilersOptions = []

    // Client
    const clientConfig = new ClientConfig(this).config()
    compilersOptions.push(clientConfig)

    // Modern
    let modernConfig
    if (options.build.modern) {
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
    Object.keys(styleResources).forEach(async (ext) => {
      await Promise.all(wrapArray(styleResources[ext]).map(async (p) => {
        const styleResourceFiles = await glob(path.resolve(this.context.options.rootDir, p))

        if (!styleResourceFiles || styleResourceFiles.length === 0) {
          throw new Error(`Style Resource not found: ${p}`)
        }
      }))
    })

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
      this.perfLoader.warmupAll()
      consola.success('Worker pools ready')
    }

    // Start Builds
    const runner = options.dev ? parallel : sequence

    await runner(this.compilers, (compiler) => {
      return this.webpackCompile(compiler)
    })
  }

  webpackCompile(compiler) {
    return new Promise(async (resolve, reject) => {
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
        nuxt.server.loadResources(this.mfs || fs)

        // Resolve on next tick
        process.nextTick(resolve)
      })

      if (options.dev) {
        // --- Dev Build ---
        // Client Build, watch is started by dev-middleware
        if (compiler.options.name === 'client') {
          return this.webpackDev(compiler)
        }
        // Server, build and watch for changes
        this.compilersWatching.push(
          compiler.watch(options.watchers.webpack, (err) => {
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
            if (options.build.quiet === true) {
              err = stats.toString(options.build.stats)
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

    const { nuxt: { server }, options } = this.context

    // Create webpack dev middleware
    this.webpackDevMiddleware = pify(
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

    this.webpackDevMiddleware.close = pify(this.webpackDevMiddleware.close)

    this.webpackHotMiddleware = pify(
      webpackHotMiddleware(
        compiler,
        Object.assign(
          {
            log: false,
            heartbeat: 10000
          },
          options.build.hotMiddleware
        )
      )
    )

    // Inject to renderer instance
    if (server) {
      server.webpackDevMiddleware = this.webpackDevMiddleware
      server.webpackHotMiddleware = this.webpackHotMiddleware
    }
  }

  async unwatch() {
    for (const watching of this.compilersWatching) {
      watching.close()
    }
    // Stop webpack middleware
    if (this.webpackDevMiddleware) {
      await this.webpackDevMiddleware.close()
    }
  }

  forGenerate() {
    this.context.isStatic = true
  }
}
