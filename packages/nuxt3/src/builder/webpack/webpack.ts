import path from 'path'
import pify from 'pify'
import webpack from 'webpack'
import Glob from 'glob'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import consola from 'consola'
import { Nuxt } from 'src/core'
import { TARGETS, parallel, sequence, wrapArray } from 'src/utils'
import { createMFS } from './utils/mfs'
import { client, server } from './configs'
import { createWebpackConfigContext, applyPresets, getWebpackConfig } from './utils/config'

const glob = pify(Glob)

class WebpackBundler {
  nuxt: Nuxt
  plugins: Array<string>

  constructor (nuxt) {
    this.nuxt = nuxt
    // TODO: plugins
    this.plugins = []

    // Class fields
    this.compilers = []
    this.compilersWatching = []
    this.devMiddleware = {}
    this.hotMiddleware = {}

    // Bind middleware to self
    this.middleware = this.middleware.bind(this)

    // Initialize shared MFS for dev
    if (this.nuxt.options.dev) {
      this.mfs = createMFS()
    }
  }

  getWebpackConfig (name) {
    const ctx = createWebpackConfigContext({ nuxt: this.nuxt })

    if (name === 'client') {
      applyPresets(ctx, client)
    } else if (name === 'server') {
      applyPresets(ctx, server)
    } else {
      throw new Error(`Unsupported webpack config ${name}`)
    }

    return getWebpackConfig(ctx)
  }

  async build () {
    const { options } = this.nuxt

    const webpackConfigs = [
      this.getWebpackConfig('client')
    ]

    if (options.modern) {
      webpackConfigs.push(this.getWebpackConfig('modern'))
    }

    if (options.build.ssr) {
      webpackConfigs.push(this.getWebpackConfig('server'))
    }

    await this.nuxt.callHook('webpack:config', webpackConfigs)

    // Check styleResource existence
    const { styleResources } = this.nuxt.options.build
    if (styleResources && Object.keys(styleResources).length) {
      consola.warn(
        'Using styleResources without the @nuxtjs/style-resources is not suggested and can lead to severe performance issues.',
        'Please use https://github.com/nuxt-community/style-resources-module'
      )
      for (const ext of Object.keys(styleResources)) {
        await Promise.all(wrapArray(styleResources[ext]).map(async (p) => {
          const styleResourceFiles = await glob(path.resolve(this.nuxt.options.rootDir, p))

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

    // Start Builds
    const runner = options.dev ? parallel : sequence

    await runner(this.compilers, compiler => this.webpackCompile(compiler))
  }

  async webpackCompile (compiler) {
    const { name } = compiler.options
    const { options } = this.nuxt

    await this.nuxt.callHook('build:compile', { name, compiler })

    // Load renderer resources after build
    compiler.hooks.done.tap('load-resources', async (stats) => {
      await this.nuxt.callHook('build:compiled', {
        name,
        compiler,
        stats
      })

      // Reload renderer
      await this.nuxt.callHook('build:resources', this.mfs)
    })

    // --- Dev Build ---
    if (options.dev) {
      // Client build
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
    await this.nuxt.callHook('build:resources')
  }

  async webpackDev (compiler) {
    consola.debug('Creating webpack middleware...')

    const { name } = compiler.options
    const buildOptions = this.nuxt.options.build
    const { client, ...hotMiddlewareOptions } = buildOptions.hotMiddleware || {}

    // Create webpack dev middleware
    this.devMiddleware[name] = pify(
      webpackDevMiddleware(
        compiler, {
          publicPath: buildOptions.publicPath,
          outputFileSystem: this.mfs,
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
    await this.nuxt.callHook('server:devMiddleware', this.middleware)
  }

  async middleware (req, res, next) {
    if (this.devMiddleware && this.devMiddleware.client) {
      await this.devMiddleware.client(req, res)
    }

    if (this.hotMiddleware && this.hotMiddleware.client) {
      await this.hotMiddleware.client(req, res)
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
    this.nuxt.options.target = TARGETS.static
  }
}

export function bundle (nuxt: Nuxt) {
  const bundler = new WebpackBundler(nuxt)
  return bundler.build()
}
