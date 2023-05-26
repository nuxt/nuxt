import pify from 'pify'
import { createCompiler } from '@rspack/core'
import type { NodeMiddleware } from 'h3'
import { fromNodeMiddleware, defineEventHandler /* useBase */ } from 'h3'
// import type { OutputFileSystem } from '@rspack/dev-middleware'
import rspackDevMiddleware from '@rspack/dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
// @ts-expect-error
import type { Compiler, Watching, Stats } from '@rspack/core'

import type { Nuxt } from '@nuxt/schema'
import { joinURL } from 'ufo'
import { logger, useNuxt } from '@nuxt/kit'
// import { createUnplugin } from 'unplugin'
import { composableKeysPlugin } from '../../vite/src/plugins/composable-keys'
import { DynamicBasePlugin } from './plugins/dynamic-base'
// import { ChunkErrorPlugin } from './plugins/chunk'
import { createMFS } from './utils/mfs'
// import { registerVirtualModules } from './virtual-modules'
import { client, server } from './configs'
import { createRspackConfigContext, applyPresets, getRspackConfig } from './utils/config'

// TODO: Support plugins
// const plugins: string[] = []

export async function bundle (nuxt: Nuxt) {
  // TODO: remove when we have support for virtual modules in rspack
  nuxt.hook('app:templates', (app) => {
    for (const template of app.templates) {
      template.write = true
    }
  })
  // registerVirtualModules()

  const webpackConfigs = [client, ...nuxt.options.ssr ? [server] : []].map((preset) => {
    const ctx = createRspackConfigContext(nuxt)
    applyPresets(ctx, preset)
    return getRspackConfig(ctx)
  })
  // @ts-ignore
  await nuxt.callHook('rspack:config', webpackConfigs)

  // Initialize shared MFS for dev
  const mfs = nuxt.options.dev ? createMFS() : null

  // Configure compilers
  const compilers = webpackConfigs.map((config) => {
    config.plugins!.push(DynamicBasePlugin.rspack({
      sourcemap: nuxt.options.sourcemap[config.name as 'client' | 'server']
    }))
    // TODO: Emit chunk errors if the user has opted in to `experimental.emitRouteChunkError`
    // if (config.name === 'client' && nuxt.options.experimental.emitRouteChunkError) {
    //   config.plugins!.push(new ChunkErrorPlugin())
    // }
    config.plugins!.push(composableKeysPlugin.rspack({
      sourcemap: nuxt.options.sourcemap[config.name as 'client' | 'server'],
      rootDir: nuxt.options.rootDir,
      composables: nuxt.options.optimization.keyedComposables
    }))

    // Create compiler
    const compiler = createCompiler(config)

    // In dev, write files in memory FS
    if (nuxt.options.dev) {
      compiler.outputFileSystem = mfs as any /* as OutputFileSystem */
    }

    return compiler
  })

  nuxt.hook('close', async () => {
    for (const compiler of compilers) {
      await new Promise<void>(resolve => compiler.close(resolve))
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
  // @ts-ignore
  const devMiddleware = rspackDevMiddleware.default(compiler as any, {
    publicPath: joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir),
    outputFileSystem: compiler.outputFileSystem as any,
    // @ts-ignore
    stats: 'none',
    serverSideRender: true,
    ...nuxt.options.webpack.devMiddleware
  })

  nuxt.hook('close', () => pify(devMiddleware.close.bind(devMiddleware))())

  const { client: _client, ...hotMiddlewareOptions } = nuxt.options.webpack.hotMiddleware || {}
  // @ts-ignore
  const hotMiddleware = webpackHotMiddleware(compiler, {
    log: false,
    heartbeat: 10000,
    path: joinURL(nuxt.options.app.baseURL, '__webpack_hmr', compiler.options.name!),
    ...hotMiddlewareOptions
  })

  // Register devMiddleware on server
  const hotHandler = fromNodeMiddleware(hotMiddleware as NodeMiddleware)
  await nuxt.callHook('server:devHandler', defineEventHandler(async (event) => {
    await hotHandler(event)
  }))

  return devMiddleware
}

async function compile (compiler: Compiler) {
  const nuxt = useNuxt()

  const { name } = compiler.options

  // @ts-ignore
  await nuxt.callHook('rspack:compile', { name: name!, compiler })

  // Load renderer resources after build
  compiler.hooks.done.tap('load-resources', async (stats) => {
    // @ts-ignore
    await nuxt.callHook('rspack:compiled', { name: name!, compiler, stats })
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
  const stats = await new Promise<Stats>((resolve, reject) => compiler.run((err, stats) => err ? reject(err) : resolve(stats!)))

  if (stats.hasErrors()) {
    const error = new Error('Nuxt build error')
    error.stack = stats.toString('errors-only')
    throw error
  }
}
