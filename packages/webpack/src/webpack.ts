import type { IncomingMessage, ServerResponse } from 'http'
import { resolve } from 'pathe'
import pify from 'pify'
import webpack from 'webpack'
import Glob from 'glob'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import VirtualModulesPlugin from 'webpack-virtual-modules'
import { logger } from '@nuxt/kit'
import type { Compiler, Watching } from 'webpack'
import type { Context as WebpackDevMiddlewareContext, Options as WebpackDevMiddlewareOptions } from 'webpack-dev-middleware'
import type { MiddlewareOptions as WebpackHotMiddlewareOptions } from 'webpack-hot-middleware'

import type { Nuxt } from '@nuxt/schema'
import { joinURL } from 'ufo'
import { DynamicBasePlugin } from '../../vite/src/plugins/dynamic-base'
import { createMFS } from './utils/mfs'
import { client, server } from './configs'
import { createWebpackConfigContext, applyPresets, getWebpackConfig } from './utils/config'

const glob = pify(Glob)
class WebpackBundler {
  nuxt: Nuxt
  plugins: Array<string>
  compilers: Array<Compiler>
  compilersWatching: Array<Watching & { closeAsync?: () => void }>
  // TODO: change this when pify has better types https://github.com/sindresorhus/pify/pull/76
  devMiddleware: Record<string, Function & { close?: () => Promise<void>, context?: WebpackDevMiddlewareContext<IncomingMessage, ServerResponse> }>
  hotMiddleware: Record<string, Function>
  virtualModules: VirtualModulesPlugin
  mfs?: Compiler['outputFileSystem']
  __closed?: boolean

  constructor (nuxt: Nuxt) {
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
      this.mfs = createMFS() as Compiler['outputFileSystem']
    }

    // Initialize virtual modules instance
    this.virtualModules = new VirtualModulesPlugin(nuxt.vfs)
    const writeFiles = () => {
      for (const filePath in nuxt.vfs) {
        this.virtualModules.writeModule(filePath, nuxt.vfs[filePath])
      }
    }
    // Workaround to initialize virtual modules
    nuxt.hook('build:compile', ({ compiler }) => {
      if (compiler.name === 'server') { writeFiles() }
    })
    // Update virtual modules when templates are updated
    nuxt.hook('app:templatesGenerated', writeFiles)
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

    if (options.ssr) {
      webpackConfigs.push(this.getWebpackConfig('server'))
    }

    await this.nuxt.callHook('webpack:config', webpackConfigs)

    // Check styleResource existence
    const { styleResources } = this.nuxt.options.build
    if (styleResources && Object.keys(styleResources).length) {
      logger.warn(
        'Using styleResources without the @nuxtjs/style-resources is not suggested and can lead to severe performance issues.',
        'Please use https://github.com/nuxt-community/style-resources-module'
      )
      for (const ext of Object.keys(styleResources)) {
        await Promise.all(Array.from(styleResources[ext]).map(async (p) => {
          const styleResourceFiles = await glob(resolve(this.nuxt.options.rootDir, p as string))

          if (!styleResourceFiles || styleResourceFiles.length === 0) {
            throw new Error(`Style Resource not found: ${p}`)
          }
        }))
      }
    }

    // Configure compilers
    this.compilers = webpackConfigs.map((config) => {
      // Support virtual modules (input)
      config.plugins.push(this.virtualModules)
      config.plugins.push(DynamicBasePlugin.webpack({
        env: this.nuxt.options.dev ? 'dev' : config.name as 'client',
        devAppConfig: this.nuxt.options.app,
        globalPublicPath: '__webpack_public_path__'
      }))

      // Create compiler
      const compiler = webpack(config)

      // In dev, write files in memory FS
      if (options.dev) {
        compiler.outputFileSystem = this.mfs!
      }

      return compiler
    })

    // Start Builds
    if (options.dev) {
      return Promise.all(this.compilers.map(c => this.webpackCompile(c)))
    } else {
      for (const c of this.compilers) {
        await this.webpackCompile(c)
      }
    }
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
          compiler.hooks.done.tap('nuxt-dev', () => { resolve(null) })
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
          resolve(null)
        })

        watching.closeAsync = pify(watching.close)
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

  async webpackDev (compiler: Compiler) {
    logger.debug('Creating webpack middleware...')

    const { name } = compiler.options
    const buildOptions = this.nuxt.options.build
    const { client, ...hotMiddlewareOptions } = buildOptions.hotMiddleware || {}

    // Create webpack dev middleware
    this.devMiddleware[name] = pify(
      // @ts-ignore
      webpackDevMiddleware(
        // @ts-ignore
        compiler,
        {
          publicPath: joinURL(this.nuxt.options.app.baseURL, this.nuxt.options.app.buildAssetsDir),
          outputFileSystem: this.mfs,
          stats: 'none',
          ...buildOptions.devMiddleware
        } as WebpackDevMiddlewareOptions<IncomingMessage, ServerResponse>
      )
    )

    this.devMiddleware[name].close = pify(this.devMiddleware[name].close)

    // @ts-ignore
    this.compilersWatching.push(this.devMiddleware[name].context.watching)

    this.hotMiddleware[name] = pify(
      webpackHotMiddleware(
        compiler as any,
        {
          log: false,
          heartbeat: 10000,
          path: joinURL(this.nuxt.options.app.baseURL, '__webpack_hmr', name),
          ...hotMiddlewareOptions
        } as WebpackHotMiddlewareOptions
      )
    )

    // Register devMiddleware on server
    await this.nuxt.callHook('server:devMiddleware', this.middleware)
  }

  async middleware (req: IncomingMessage, res: ServerResponse, next: () => any) {
    if (this.devMiddleware && this.devMiddleware.client) {
      await this.devMiddleware.client(req, res)
    }

    if (this.hotMiddleware && this.hotMiddleware.client) {
      await this.hotMiddleware.client(req, res)
    }

    next()
  }

  async unwatch () {
    await Promise.all(this.compilersWatching.map(watching => watching.closeAsync()))
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
      await new Promise(resolve => compiler.close(resolve))
    }

    // Cleanup MFS
    if (this.mfs) {
      delete this.mfs
    }

    // Cleanup more resources
    delete this.compilers
    delete this.compilersWatching
    delete this.devMiddleware
    delete this.hotMiddleware
  }

  forGenerate () {
    this.nuxt.options.target = 'static'
  }
}

export function bundle (nuxt: Nuxt) {
  const bundler = new WebpackBundler(nuxt)
  return bundler.build()
}
