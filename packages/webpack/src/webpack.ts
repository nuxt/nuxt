import pify from 'pify'
import webpack from 'webpack'
import type { NodeMiddleware } from 'h3'
import { defineEventHandler, fromNodeMiddleware } from 'h3'
import type { OutputFileSystem } from 'webpack-dev-middleware'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import type { Compiler, Watching } from 'webpack'

import type { Nuxt } from '@nuxt/schema'
import { joinURL } from 'ufo'
import { logger, useNuxt } from '@nuxt/kit'
import { composableKeysPlugin } from '../../vite/src/plugins/composable-keys'
import { DynamicBasePlugin } from './plugins/dynamic-base'
import { ChunkErrorPlugin } from './plugins/chunk'
import { createMFS } from './utils/mfs'
import { registerVirtualModules } from './virtual-modules'
import { client, server } from './configs'
import { applyPresets, createWebpackConfigContext, getWebpackConfig } from './utils/config'

// TODO: Support plugins
// const plugins: string[] = []

export async function bundle (nuxt: Nuxt) {
  registerVirtualModules()

  const webpackConfigs = [client, ...nuxt.options.ssr ? [server] : []].map((preset) => {
    const ctx = createWebpackConfigContext(nuxt)
    applyPresets(ctx, preset)
    return getWebpackConfig(ctx)
  })

  await nuxt.callHook('webpack:config', webpackConfigs)

  // Initialize shared MFS for dev
  const mfs = nuxt.options.dev ? createMFS() : null

  // Configure compilers
  const compilers = webpackConfigs.map((config) => {
    config.plugins!.push(DynamicBasePlugin.webpack({
      sourcemap: nuxt.options.sourcemap[config.name as 'client' | 'server']
    }))
    // Emit chunk errors if the user has opted in to `experimental.emitRouteChunkError`
    if (config.name === 'client' && nuxt.options.experimental.emitRouteChunkError) {
      config.plugins!.push(new ChunkErrorPlugin())
    }
    config.plugins!.push(composableKeysPlugin.webpack({
      sourcemap: nuxt.options.sourcemap[config.name as 'client' | 'server'],
      rootDir: nuxt.options.rootDir,
      composables: nuxt.options.optimization.keyedComposables
    }))

    // Create compiler
    const compiler = webpack(config)

    // In dev, write files in memory FS
    if (nuxt.options.dev) {
      compiler.outputFileSystem = mfs as unknown as OutputFileSystem
    }

    return compiler
  })

  nuxt.hook('close', async () => {
    for (const compiler of compilers) {
      await new Promise(resolve => compiler.close(resolve))
    }
  })

  // Start Builds
  if (nuxt.options.dev) {
    return Promise.all(compilers.map(c => compile(c)))
  }

  for (const c of compilers) {
    await compile(c)
  }
}

async function createDevMiddleware (compiler: Compiler) {
  const nuxt = useNuxt()

  logger.debug('Creating webpack middleware...')

  // Create webpack dev middleware
  const devMiddleware = webpackDevMiddleware(compiler, {
    publicPath: joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir),
    outputFileSystem: compiler.outputFileSystem as any,
    stats: 'none',
    ...nuxt.options.webpack.devMiddleware
  })

  // @ts-ignore
  nuxt.hook('close', () => pify(devMiddleware.close.bind(devMiddleware))())

  const { client: _client, ...hotMiddlewareOptions } = nuxt.options.webpack.hotMiddleware || {}
  const hotMiddleware = webpackHotMiddleware(compiler, {
    log: false,
    heartbeat: 10000,
    path: joinURL(nuxt.options.app.baseURL, '__webpack_hmr', compiler.options.name!),
    ...hotMiddlewareOptions
  })

  // Register devMiddleware on server
  const devHandler = fromNodeMiddleware(devMiddleware as NodeMiddleware)
  const hotHandler = fromNodeMiddleware(hotMiddleware as NodeMiddleware)
  await nuxt.callHook('server:devHandler', defineEventHandler(async (event) => {
    await devHandler(event)
    await hotHandler(event)
  }))

  return devMiddleware
}

async function compile (compiler: Compiler) {
  const nuxt = useNuxt()

  const { name } = compiler.options

  await nuxt.callHook('webpack:compile', { name: name!, compiler })

  // Load renderer resources after build
  compiler.hooks.done.tap('load-resources', async (stats) => {
    await nuxt.callHook('webpack:compiled', { name: name!, compiler, stats })
  })

  // --- Dev Build ---
  if (nuxt.options.dev) {
    const compilersWatching: Watching[] = []

    nuxt.hook('close', async () => {
      await Promise.all(compilersWatching.map(watching => pify(watching.close.bind(watching))()))
    })

    // Client build
    if (name === 'client') {
      return new Promise((resolve, reject) => {
        compiler.hooks.done.tap('nuxt-dev', () => { resolve(null) })
        compiler.hooks.failed.tap('nuxt-errorlog', (err) => { reject(err) })
        // Start watch
        createDevMiddleware(compiler).then((devMiddleware) => {
          compilersWatching.push(devMiddleware.context.watching)
        })
      })
    }

    // Server, build and watch for changes
    return new Promise((resolve, reject) => {
      const watching = compiler.watch(nuxt.options.watchers.webpack, (err) => {
        if (err) { return reject(err) }
        resolve(null)
      })

      compilersWatching.push(watching)
    })
  }

  // --- Production Build ---
  const stats = await new Promise<webpack.Stats>((resolve, reject) => compiler.run((err, stats) => err ? reject(err) : resolve(stats!)))

  if (stats.hasErrors()) {
    const error = new Error('Nuxt build error')
    error.stack = stats.toString('errors-only')
    throw error
  }
}
